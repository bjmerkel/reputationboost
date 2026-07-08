import type { ClientConfig } from "@/audit/types";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import {
  getCustomersByIds,
  getEligibleCustomers,
  listCustomers,
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
import {
  evaluateReviewRequestEligibility,
  ineligibilityMessage,
} from "@/lib/review-requests/eligibility";
import { personalizeReviewRequestSms } from "@/lib/sms/personalize";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { isTwilioConfigured, sendSms } from "@/lib/sms/twilio";

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
}

export interface SendReviewRequestsResult {
  sent: number;
  failed: number;
  skipped: number;
  simulated: boolean;
  keywordFilterApplied: boolean;
  reviewUrl: string | null;
  messages: Array<{
    customerId: string;
    phone: string;
    body: string;
    status: "sent" | "failed" | "skipped" | "simulated";
    error?: string;
    skipReason?: string;
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

async function resolveCustomers(
  userId: string,
  businessId: string,
  customerIds: string[] | undefined,
  batchSize: number,
  serviceRole: boolean,
  focusKeyword?: string | null
): Promise<{ customers: CustomerRecord[]; keywordFilterApplied: boolean }> {
  if (customerIds && customerIds.length > 0) {
    const customers = serviceRole
      ? await getCustomersByIdsAdmin(businessId, customerIds)
      : await getCustomersByIds(userId, businessId, customerIds);
    return { customers, keywordFilterApplied: false };
  }

  const poolSize = focusKeyword?.trim() ? Math.max(batchSize * 4, 100) : batchSize;
  const pool = serviceRole
    ? await getEligibleCustomersAdmin(businessId, poolSize)
    : await getEligibleCustomers(userId, businessId, poolSize);

  if (!focusKeyword?.trim()) {
    return { customers: pool.slice(0, batchSize), keywordFilterApplied: false };
  }

  return selectCustomersForCampaign(pool, focusKeyword, batchSize);
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
  const { customers, keywordFilterApplied } = await resolveCustomers(
    input.userId,
    businessId,
    input.customerIds,
    batchSize,
    input.serviceRole ?? false,
    input.focusKeyword
  );

  const result: SendReviewRequestsResult = {
    sent: 0,
    failed: 0,
    skipped: 0,
    simulated: !isTwilioConfigured() && !input.dryRun,
    keywordFilterApplied,
    reviewUrl,
    messages: [],
  };

  const sentCustomerIds: string[] = [];
  const manualSend = input.manualSend !== false;
  const hasReviewGap = input.auditHasReviewGap ?? true;
  const focusKeyword = input.focusKeyword?.trim() || null;

  for (const customer of customers) {
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
      });
      continue;
    }

    const body = personalizeReviewRequestSms({
      template: input.template,
      customer,
      businessName: input.business.name,
      reviewUrl,
    });

    if (input.dryRun) {
      result.messages.push({
        customerId: customer.id,
        phone: customer.phone,
        body,
        status: "simulated",
      });
      continue;
    }

    if (!isTwilioConfigured()) {
      const logMessage = input.serviceRole ? logSmsMessageAdmin : logSmsMessage;
      await logMessage(input.userId, {
        businessId,
        customerId: customer.id,
        executionTaskId: input.executionTaskId,
        focusKeyword,
        toPhone: customer.phone,
        body,
        status: "simulated",
      });
      sentCustomerIds.push(customer.id);
      result.sent++;
      result.messages.push({
        customerId: customer.id,
        phone: customer.phone,
        body,
        status: "simulated",
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
        focusKeyword,
        toPhone: sms.to,
        body,
        status: "sent",
        providerSid: sms.sid,
      });
      sentCustomerIds.push(customer.id);
      result.sent++;
      result.messages.push({
        customerId: customer.id,
        phone: sms.to,
        body,
        status: "sent",
      });
    } else {
      const logMessage = input.serviceRole ? logSmsMessageAdmin : logSmsMessage;
      await logMessage(input.userId, {
        businessId,
        customerId: customer.id,
        executionTaskId: input.executionTaskId,
        focusKeyword,
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
      });
    }
  }

  if (!input.dryRun && sentCustomerIds.length > 0) {
    if (input.serviceRole) {
      await markCustomersReviewRequestedAdmin(businessId, sentCustomerIds);
    } else {
      await markCustomersReviewRequested(input.userId, businessId, sentCustomerIds);
    }

    await startCampaignIfNeeded({
      userId: input.userId,
      business: input.business,
      focusKeyword,
      serviceRole: input.serviceRole,
      sentCount: result.sent,
    });
  }

  return result;
}
