import type { ClientConfig, FullAuditPayload } from "@/audit/types";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import {
  getCustomersByIds,
  getEligibleCustomers,
  logSmsMessage,
  markCustomersReviewRequested,
} from "@/lib/customers/storage";
import {
  getCustomersByIdsAdmin,
  getEligibleCustomersAdmin,
  logSmsMessageAdmin,
  markCustomersReviewRequestedAdmin,
} from "@/lib/customers/storage-admin";
import type { CustomerRecord } from "@/lib/customers/types";
import {
  countReviewMentionsForKeyword,
  selectCustomersForCampaign,
} from "@/lib/review-requests/campaign-plan";
import { ensureKeywordCampaignStarted } from "@/lib/review-requests/campaign-storage";
import { refreshCampaignCompletionsForBusiness } from "@/lib/review-requests/campaign-dashboard";
import {
  evaluateReviewRequestEligibility,
  ineligibilityMessage,
} from "@/lib/review-requests/eligibility";
import type { GeoRoutingDecision } from "@/lib/review-velocity/geo-router";
import { selectCustomersForGeoCampaign } from "@/lib/review-velocity/geo-router";
import {
  loadKeywordGridsForAudit,
  routeCustomerGeoReview,
} from "@/lib/review-velocity/resolve-geo-routing";
import { personalizeReviewRequestSms } from "@/lib/sms/personalize";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { isTwilioConfigured, sendSms } from "@/lib/sms/twilio";
import type { GeoGridPoint } from "@/audit/types";

export interface SendReviewRequestsInput {
  userId: string;
  business: ClientConfig;
  template: string;
  customerIds?: string[];
  batchSize?: number;
  executionTaskId?: string;
  dryRun?: boolean;
  /** Use service-role client (for inbound webhooks without a user session). */
  serviceRole?: boolean;
  /** Skip audit-gap checks for explicit UI sends. Defaults to true for manual sends. */
  manualSend?: boolean;
  /** When set, eligible customers matching this keyword are sent first. */
  focusKeyword?: string | null;
  auditHasReviewGap?: boolean;
  reviewUrlOverride?: string;
  /** Geo-targeted routing metadata for a single-customer webhook send. */
  geoRouting?: GeoRoutingDecision | null;
  /** When true (default for batch sends), prioritize customers in weak grid cells. */
  enableGeoRouting?: boolean;
}

export interface SendReviewRequestsResult {
  sent: number;
  failed: number;
  skipped: number;
  simulated: boolean;
  keywordFilterApplied: boolean;
  geoFilterApplied: boolean;
  reviewUrl: string | null;
  messages: Array<{
    customerId: string;
    phone: string;
    body: string;
    status: "sent" | "failed" | "skipped" | "simulated";
    error?: string;
    skipReason?: string;
    geoTargeted?: boolean;
    targetZone?: string | null;
  }>;
}

function resolveReviewUrl(business: ClientConfig): string | null {
  const address = [
    business.location.address,
    business.location.city,
    business.location.state,
    business.location.zip,
  ]
    .filter(Boolean)
    .join(", ");

  return googleReviewUrlForBusiness({
    placeId: business.gbpPlaceId,
    mapsUrl: business.gbpMapsUrl,
    name: business.name,
    address,
  });
}

async function loadAuditForSend(
  userId: string,
  business: ClientConfig
): Promise<FullAuditPayload | null> {
  if (!business.businessId) return null;
  const rawAudit = await loadLatestAuditFromSupabase(userId, business.id, {
    businessName: business.name,
    businessUuid: business.businessId,
  });
  return rawAudit ? ensureStrategy(rawAudit) : null;
}

async function resolveCustomers(input: {
  userId: string;
  businessId: string;
  customerIds?: string[];
  batchSize: number;
  serviceRole: boolean;
  focusKeyword?: string | null;
  audit?: FullAuditPayload | null;
  keywordGrids?: Map<string, GeoGridPoint[]>;
  enableGeoRouting?: boolean;
}): Promise<{
  customers: CustomerRecord[];
  keywordFilterApplied: boolean;
  geoFilterApplied: boolean;
}> {
  if (input.customerIds && input.customerIds.length > 0) {
    const customers = input.serviceRole
      ? await getCustomersByIdsAdmin(input.businessId, input.customerIds)
      : await getCustomersByIds(input.userId, input.businessId, input.customerIds);
    return { customers, keywordFilterApplied: false, geoFilterApplied: false };
  }

  const poolSize = input.focusKeyword?.trim() ? Math.max(input.batchSize * 4, 100) : input.batchSize;
  const pool = input.serviceRole
    ? await getEligibleCustomersAdmin(input.businessId, poolSize)
    : await getEligibleCustomers(input.userId, input.businessId, poolSize);

  if (
    input.enableGeoRouting &&
    input.audit &&
    input.keywordGrids &&
    input.keywordGrids.size > 0
  ) {
    const geoSelected = selectCustomersForGeoCampaign({
      customers: pool,
      audit: input.audit,
      keywordGrids: input.keywordGrids,
      batchSize: input.batchSize,
      focusKeyword: input.focusKeyword,
    });
    if (geoSelected.geoFilterApplied) {
      return {
        customers: geoSelected.customers,
        keywordFilterApplied: false,
        geoFilterApplied: true,
      };
    }
  }

  if (!input.focusKeyword?.trim()) {
    return { customers: pool.slice(0, input.batchSize), keywordFilterApplied: false, geoFilterApplied: false };
  }

  const keywordSelected = selectCustomersForCampaign(pool, input.focusKeyword, input.batchSize);
  return {
    customers: keywordSelected.customers,
    keywordFilterApplied: keywordSelected.keywordFilterApplied,
    geoFilterApplied: false,
  };
}

async function startCampaignIfNeeded(input: {
  userId: string;
  business: ClientConfig;
  focusKeyword?: string | null;
  serviceRole?: boolean;
  sentCount: number;
}): Promise<void> {
  const keyword = input.focusKeyword?.trim();
  if (!keyword || input.sentCount <= 0 || !input.business.businessId) return;

  const rawAudit = await loadLatestAuditFromSupabase(input.userId, input.business.id, {
    businessName: input.business.name,
    businessUuid: input.business.businessId,
  });
  const audit = rawAudit ? ensureStrategy(rawAudit) : null;
  if (!audit) return;

  const target = audit.strategy.gbpPlan?.keywordRankings?.find(
    (row) => row.keyword.toLowerCase() === keyword.toLowerCase()
  );

  await ensureKeywordCampaignStarted({
    userId: input.userId,
    businessId: input.business.businessId,
    keyword,
    baselineMentionCount: countReviewMentionsForKeyword(audit, keyword),
    targetReviews: target ? Math.max(5, Math.ceil(target.reviewGap * 0.3)) : undefined,
    serviceRole: input.serviceRole,
  });

  await refreshCampaignCompletionsForBusiness(
    input.userId,
    input.business.businessId,
    audit
  );
}

export async function sendReviewRequests(
  input: SendReviewRequestsInput
): Promise<SendReviewRequestsResult> {
  const businessId = input.business.businessId;
  if (!businessId) {
    throw new Error("Business ID is required");
  }

  const reviewUrl = input.reviewUrlOverride ?? resolveReviewUrl(input.business);
  if (!reviewUrl) {
    throw new Error(
      "No Google review link available. Connect your Google Business Profile or add a Place ID in settings."
    );
  }

  const batchSize = input.batchSize ?? 15;
  const enableGeoRouting =
    input.enableGeoRouting !== false && !input.geoRouting && !(input.customerIds?.length === 1);

  let audit: FullAuditPayload | null = null;
  let keywordGrids: Map<string, GeoGridPoint[]> | undefined;

  if (enableGeoRouting || input.geoRouting) {
    audit = await loadAuditForSend(input.userId, input.business);
    if (audit && enableGeoRouting) {
      keywordGrids = await loadKeywordGridsForAudit(businessId, audit);
    }
  }

  const { customers, keywordFilterApplied, geoFilterApplied } = await resolveCustomers({
    userId: input.userId,
    businessId,
    customerIds: input.customerIds,
    batchSize,
    serviceRole: input.serviceRole ?? false,
    focusKeyword: input.focusKeyword,
    audit,
    keywordGrids,
    enableGeoRouting,
  });

  const result: SendReviewRequestsResult = {
    sent: 0,
    failed: 0,
    skipped: 0,
    simulated: !isTwilioConfigured() && !input.dryRun,
    keywordFilterApplied,
    geoFilterApplied,
    reviewUrl,
    messages: [],
  };

  const sentCustomerIds: string[] = [];
  const sentFocusKeywords = new Set<string>();
  const manualSend = input.manualSend !== false;
  const hasReviewGap = input.auditHasReviewGap ?? true;
  const defaultFocusKeyword = input.focusKeyword?.trim() || null;

  for (const customer of customers) {
    let customerGeoRouting = input.geoRouting ?? null;
    let customerFocusKeyword = defaultFocusKeyword;

    if (!customerGeoRouting && enableGeoRouting && audit && keywordGrids && keywordGrids.size > 0) {
      const routed = await routeCustomerGeoReview({
        businessId,
        business: input.business,
        customer,
        audit,
        keywordGrids,
        checkCellCap: true,
      });

      if (routed.deferred) {
        result.skipped++;
        result.messages.push({
          customerId: customer.id,
          phone: customer.phone,
          body: "",
          status: "skipped",
          error: "Weekly review request cap reached for this map area.",
          skipReason: routed.deferReason,
          geoTargeted: true,
          targetZone: routed.geoRouting?.targetZone ?? null,
        });
        continue;
      }

      customerGeoRouting = routed.geoRouting;
      customerFocusKeyword = routed.geoRouting?.focusKeyword ?? customerFocusKeyword;
    } else if (input.geoRouting) {
      customerFocusKeyword = input.geoRouting.focusKeyword ?? customerFocusKeyword;
    }

    const neighborhoodLabel = customerGeoRouting?.neighborhoodLabel ?? null;

    const eligibility = evaluateReviewRequestEligibility({
      customer,
      manualSend,
      auditHasReviewGap: hasReviewGap,
    });

    if (!eligibility.eligible) {
      result.skipped++;
      result.messages.push({
        customerId: customer.id,
        phone: customer.phone,
        body: "",
        status: "skipped",
        error: eligibility.reason ? ineligibilityMessage(eligibility.reason) : "Not eligible",
        skipReason: eligibility.reason,
        geoTargeted: customerGeoRouting?.geoTargeted ?? false,
        targetZone: customerGeoRouting?.targetZone ?? null,
      });
      continue;
    }

    const body = personalizeReviewRequestSms({
      template: input.template,
      customer,
      businessName: input.business.name,
      reviewUrl,
      focusKeyword: customerFocusKeyword,
      neighborhoodLabel,
      location: {
        city: input.business.location.city,
        state: input.business.location.state,
      },
    });

    if (input.dryRun) {
      result.messages.push({
        customerId: customer.id,
        phone: customer.phone,
        body,
        status: "simulated",
        geoTargeted: customerGeoRouting?.geoTargeted ?? false,
        targetZone: customerGeoRouting?.targetZone ?? null,
      });
      continue;
    }

    if (!isTwilioConfigured()) {
      const logMessage = input.serviceRole ? logSmsMessageAdmin : logSmsMessage;
      await logMessage(input.userId, {
        businessId,
        customerId: customer.id,
        executionTaskId: input.executionTaskId,
        focusKeyword: customerFocusKeyword,
        targetGridNorth: customerGeoRouting?.targetCell.gridNorth ?? null,
        targetGridEast: customerGeoRouting?.targetCell.gridEast ?? null,
        targetZone: customerGeoRouting?.targetZone ?? null,
        neighborhoodLabel,
        toPhone: customer.phone,
        body,
        status: "simulated",
      });
      sentCustomerIds.push(customer.id);
      if (customerFocusKeyword) sentFocusKeywords.add(customerFocusKeyword);
      result.sent++;
      result.messages.push({
        customerId: customer.id,
        phone: customer.phone,
        body,
        status: "simulated",
        geoTargeted: customerGeoRouting?.geoTargeted ?? false,
        targetZone: customerGeoRouting?.targetZone ?? null,
      });
      continue;
    }

    const sms = await sendSms(customer.phone, body);

    if (sms.success) {
      const logMessage = input.serviceRole ? logSmsMessageAdmin : logSmsMessage;
      await logMessage(input.userId, {
        businessId,
        customerId: customer.id,
        executionTaskId: input.executionTaskId,
        focusKeyword: customerFocusKeyword,
        targetGridNorth: customerGeoRouting?.targetCell.gridNorth ?? null,
        targetGridEast: customerGeoRouting?.targetCell.gridEast ?? null,
        targetZone: customerGeoRouting?.targetZone ?? null,
        neighborhoodLabel,
        toPhone: sms.to,
        body,
        status: "sent",
        providerSid: sms.sid,
      });
      sentCustomerIds.push(customer.id);
      if (customerFocusKeyword) sentFocusKeywords.add(customerFocusKeyword);
      result.sent++;
      result.messages.push({
        customerId: customer.id,
        phone: sms.to,
        body,
        status: "sent",
        geoTargeted: customerGeoRouting?.geoTargeted ?? false,
        targetZone: customerGeoRouting?.targetZone ?? null,
      });
    } else {
      const logMessage = input.serviceRole ? logSmsMessageAdmin : logSmsMessage;
      await logMessage(input.userId, {
        businessId,
        customerId: customer.id,
        executionTaskId: input.executionTaskId,
        focusKeyword: customerFocusKeyword,
        targetGridNorth: customerGeoRouting?.targetCell.gridNorth ?? null,
        targetGridEast: customerGeoRouting?.targetCell.gridEast ?? null,
        targetZone: customerGeoRouting?.targetZone ?? null,
        neighborhoodLabel,
        toPhone: customer.phone,
        body,
        status: "failed",
        errorMessage: sms.error,
      });
      result.failed++;
      result.messages.push({
        customerId: customer.id,
        phone: customer.phone,
        body,
        status: "failed",
        error: sms.error,
        geoTargeted: customerGeoRouting?.geoTargeted ?? false,
        targetZone: customerGeoRouting?.targetZone ?? null,
      });
    }
  }

  if (!input.dryRun && sentCustomerIds.length > 0) {
    if (input.serviceRole) {
      await markCustomersReviewRequestedAdmin(businessId, sentCustomerIds);
    } else {
      await markCustomersReviewRequested(input.userId, businessId, sentCustomerIds);
    }

    const keywordsToStart =
      sentFocusKeywords.size > 0
        ? [...sentFocusKeywords]
        : defaultFocusKeyword
          ? [defaultFocusKeyword]
          : [];

    for (const keyword of keywordsToStart) {
      await startCampaignIfNeeded({
        userId: input.userId,
        business: input.business,
        focusKeyword: keyword,
        serviceRole: input.serviceRole,
        sentCount: result.sent,
      });
    }
  }

  return result;
}
