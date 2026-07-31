import type { ClientConfig } from "@/audit/types";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { buildReviewEmailContent } from "@/lib/email/template";
import { buildUnsubscribeUrl } from "@/lib/email/unsubscribe";
import { normalizeEmail } from "@/lib/email/resend";
import { getOutreachTargets } from "@/lib/customers/outreach-targets";
import {
  getCustomersByIds,
  getEligibleCustomers,
} from "@/lib/customers/storage";
import type { CustomerRecord } from "@/lib/customers/types";
import {
  selectCustomersForCampaign,
} from "@/lib/review-requests/campaign-plan";
import type { OutreachChannel } from "@/lib/review-requests/channel";
import {
  auditHasReviewGap,
  evaluateReviewRequestEligibility,
  type IneligibilityReason,
} from "@/lib/review-requests/eligibility";
import {
  CAMPAIGN_IMMEDIATE_QUEUE_THRESHOLD,
  CAMPAIGN_QUEUE_CHUNK_SIZE,
  CAMPAIGN_QUEUE_JOBS_PER_CRON,
  DEFAULT_DAILY_SEND_CAP,
  MAX_OUTREACH_CAMPAIGN_SIZE,
} from "@/lib/review-requests/bulk-config";
import {
  scheduleReviewRequestEmail,
  scheduleReviewRequestSms,
} from "@/lib/review-requests/scheduled-sms";
import { selectCustomersForGeoCampaign } from "@/lib/review-velocity/geo-router";
import { loadCellLiftAggregatesForUser } from "@/lib/review-velocity/lift-storage";
import {
  loadKeywordGridsForAudit,
  routeCustomerGeoReview,
} from "@/lib/review-velocity/resolve-geo-routing";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { normalizePhoneE164 } from "@/lib/sms/phone";
import { createAdminClient } from "@/lib/supabase/admin";

export type OutreachCampaignStatus =
  | "planning"
  | "queuing"
  | "active"
  | "completed"
  | "cancelled"
  | "failed";

export interface PlannedOutreachEntry {
  customerId: string;
  sendSms: boolean;
  sendEmail: boolean;
  scheduleIndex: number;
}

export interface OutreachCampaignRecord {
  id: string;
  businessId: string;
  userId: string;
  status: OutreachCampaignStatus;
  channel: OutreachChannel;
  focusKeyword: string | null;
  smsTemplate: string;
  emailTemplate: string;
  emailSubject: string | null;
  targetCount: number;
  queuedSmsCount: number;
  queuedEmailCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  dailySendCap: number;
  spreadStartAt: string;
  queueOffset: number;
  dryRun: boolean;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface OutreachCampaignPreview {
  eligible: number;
  smsCount: number;
  emailCount: number;
  skipped: Partial<Record<IneligibilityReason | "no_contact", number>>;
  estimatedDays: number;
  dailySendCap: number;
  spreadStartAt: string;
  keywordFilterApplied: boolean;
  geoFilterApplied: boolean;
  reviewUrl: string | null;
  plannedEntries: PlannedOutreachEntry[];
}

export interface PlanOutreachCampaignInput {
  userId: string;
  business: ClientConfig;
  channel: OutreachChannel;
  smsTemplate: string;
  emailTemplate: string;
  emailSubject?: string;
  customerIds?: string[];
  focusKeyword?: string | null;
  dailySendCap?: number;
  spreadStartAt?: Date;
  enableGeoRouting?: boolean;
  auditHasReviewGap?: boolean;
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

function scheduleAtForIndex(index: number, dailyCap: number, startAt: Date): Date {
  const dayOffset = Math.floor(index / dailyCap);
  const slotInDay = index % dailyCap;
  const minutesPerSlot = Math.max(5, Math.floor(600 / dailyCap));
  const jitter = Math.floor(Math.random() * 10);
  const result = new Date(startAt);
  result.setUTCDate(result.getUTCDate() + dayOffset);
  result.setUTCHours(14, 0, 0, 0);
  result.setUTCMinutes(result.getUTCMinutes() + slotInDay * minutesPerSlot + jitter);
  return result;
}

function rowToCampaign(row: Record<string, unknown>): OutreachCampaignRecord {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    userId: row.user_id as string,
    status: row.status as OutreachCampaignStatus,
    channel: row.channel as OutreachChannel,
    focusKeyword: (row.focus_keyword as string | null) ?? null,
    smsTemplate: row.sms_template as string,
    emailTemplate: (row.email_template as string | null) ?? "",
    emailSubject: (row.email_subject as string | null) ?? null,
    targetCount: Number(row.target_count ?? 0),
    queuedSmsCount: Number(row.queued_sms_count ?? 0),
    queuedEmailCount: Number(row.queued_email_count ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    dailySendCap: Number(row.daily_send_cap ?? DEFAULT_DAILY_SEND_CAP),
    spreadStartAt: row.spread_start_at as string,
    queueOffset: Number(row.queue_offset ?? 0),
    dryRun: Boolean(row.dry_run),
    errorMessage: (row.error_message as string | null) ?? null,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

export async function planOutreachCampaign(
  input: PlanOutreachCampaignInput
): Promise<OutreachCampaignPreview> {
  const businessId = input.business.businessId;
  if (!businessId) throw new Error("Business ID is required");

  const reviewUrl = resolveReviewUrl(input.business);
  if (!reviewUrl) {
    throw new Error(
      "No Google review link available. Connect your Google Business Profile or add a Place ID in settings."
    );
  }

  const rawAudit = await loadLatestAuditFromSupabase(input.userId, input.business.id, {
    businessName: input.business.name,
    businessUuid: businessId,
  });
  const audit = rawAudit ? ensureStrategy(rawAudit) : null;
  const hasReviewGap = input.auditHasReviewGap ?? auditHasReviewGap(audit);

  let pool: CustomerRecord[];
  if (input.customerIds?.length) {
    pool = await getCustomersByIds(input.userId, businessId, input.customerIds);
  } else {
    pool = await getEligibleCustomers(input.userId, businessId, MAX_OUTREACH_CAMPAIGN_SIZE);
  }

  const skipped: Partial<Record<IneligibilityReason | "no_contact", number>> = {};
  const eligibleCustomers: CustomerRecord[] = [];

  for (const customer of pool) {
    const eligibility = evaluateReviewRequestEligibility({
      customer,
      manualSend: true,
      auditHasReviewGap: hasReviewGap,
    });
    if (!eligibility.eligible) {
      const key = eligibility.reason ?? "cooldown_active";
      skipped[key] = (skipped[key] ?? 0) + 1;
      continue;
    }
    eligibleCustomers.push(customer);
  }

  let selected = eligibleCustomers;
  let geoFilterApplied = false;
  let keywordFilterApplied = false;
  const enableGeoRouting = input.enableGeoRouting !== false;

  if (enableGeoRouting && audit && selected.length > 0) {
    const keywordGrids = await loadKeywordGridsForAudit(businessId, audit);
    if (keywordGrids.size > 0) {
      const liftAggregates = await loadCellLiftAggregatesForUser(businessId);
      const geoSelected = selectCustomersForGeoCampaign({
        customers: selected,
        audit,
        keywordGrids,
        batchSize: selected.length,
        focusKeyword: input.focusKeyword,
        liftAggregates,
      });
      selected = geoSelected.customers;
      geoFilterApplied = geoSelected.geoFilterApplied;
    }
  }

  if (input.focusKeyword?.trim() && !geoFilterApplied && selected.length > 0) {
    const keywordSelected = selectCustomersForCampaign(
      selected,
      input.focusKeyword,
      selected.length
    );
    selected = keywordSelected.customers;
    keywordFilterApplied = keywordSelected.keywordFilterApplied;
  }

  const dailySendCap = Math.max(1, input.dailySendCap ?? DEFAULT_DAILY_SEND_CAP);
  const spreadStartAt = input.spreadStartAt ?? new Date();
  const plannedEntries: PlannedOutreachEntry[] = [];
  let smsCount = 0;
  let emailCount = 0;
  let scheduleIndex = 0;

  for (const customer of selected) {
    const targets = getOutreachTargets(input.channel, customer);
    if (!targets.email && !targets.sms) {
      skipped.no_contact = (skipped.no_contact ?? 0) + 1;
      continue;
    }

    if (targets.sms) smsCount++;
    if (targets.email) emailCount++;

    plannedEntries.push({
      customerId: customer.id,
      sendSms: targets.sms,
      sendEmail: targets.email,
      scheduleIndex,
    });
    scheduleIndex++;
  }

  const estimatedDays = Math.max(1, Math.ceil(scheduleIndex / dailySendCap));

  return {
    eligible: plannedEntries.length,
    smsCount,
    emailCount,
    skipped,
    estimatedDays,
    dailySendCap,
    spreadStartAt: spreadStartAt.toISOString(),
    keywordFilterApplied,
    geoFilterApplied,
    reviewUrl,
    plannedEntries,
  };
}

async function loadCampaignAdmin(campaignId: string): Promise<
  OutreachCampaignRecord & { plannedEntries: PlannedOutreachEntry[] }
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("outreach_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Campaign not found");

  const plannedEntries = Array.isArray(data.planned_entries)
    ? (data.planned_entries as PlannedOutreachEntry[])
    : [];

  return { ...rowToCampaign(data), plannedEntries };
}

export async function getOutreachCampaign(
  campaignId: string,
  userId: string
): Promise<OutreachCampaignRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("outreach_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToCampaign(data) : null;
}

export async function listOutreachCampaigns(
  businessId: string,
  userId: string,
  limit = 10
): Promise<OutreachCampaignRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("outreach_campaigns")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToCampaign(row));
}

export async function createOutreachCampaign(input: {
  userId: string;
  business: ClientConfig;
  channel: OutreachChannel;
  smsTemplate: string;
  emailTemplate: string;
  emailSubject?: string;
  customerIds?: string[];
  focusKeyword?: string | null;
  dailySendCap?: number;
  spreadStartAt?: Date;
  dryRun?: boolean;
  enableGeoRouting?: boolean;
  auditHasReviewGap?: boolean;
}): Promise<{ campaign: OutreachCampaignRecord; preview: OutreachCampaignPreview }> {
  const businessId = input.business.businessId;
  if (!businessId) throw new Error("Business ID is required");

  if ((input.channel === "email" || input.channel === "auto") && !input.emailSubject?.trim()) {
    throw new Error("Email subject is required");
  }

  const preview = await planOutreachCampaign({
    userId: input.userId,
    business: input.business,
    channel: input.channel,
    smsTemplate: input.smsTemplate,
    emailTemplate: input.emailTemplate,
    emailSubject: input.emailSubject,
    customerIds: input.customerIds,
    focusKeyword: input.focusKeyword,
    dailySendCap: input.dailySendCap,
    spreadStartAt: input.spreadStartAt,
    enableGeoRouting: input.enableGeoRouting,
    auditHasReviewGap: input.auditHasReviewGap,
  });

  if (preview.plannedEntries.length === 0) {
    throw new Error("No eligible customers to queue for this campaign.");
  }

  if (preview.plannedEntries.length > MAX_OUTREACH_CAMPAIGN_SIZE) {
    throw new Error(
      `Campaign exceeds maximum of ${MAX_OUTREACH_CAMPAIGN_SIZE.toLocaleString()} customers.`
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("outreach_campaigns")
    .insert({
      business_id: businessId,
      user_id: input.userId,
      status: input.dryRun ? "planning" : "queuing",
      channel: input.channel,
      focus_keyword: input.focusKeyword?.trim() || null,
      sms_template: input.smsTemplate,
      email_template: input.emailTemplate,
      email_subject: input.emailSubject?.trim() || null,
      target_count: preview.plannedEntries.length,
      daily_send_cap: preview.dailySendCap,
      spread_start_at: preview.spreadStartAt,
      planned_entries: preview.plannedEntries,
      dry_run: input.dryRun ?? false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const campaign = rowToCampaign(data);

  if (!input.dryRun) {
    let done = false;
    let guard = 0;
    while (!done && guard < 20) {
      const chunkResult = await queueOutreachCampaignChunk(campaign.id);
      done = chunkResult.done;
      guard++;
    }
    await refreshOutreachCampaignStats(campaign.id);
    const refreshed = await getOutreachCampaign(campaign.id, input.userId);
    return { campaign: refreshed ?? campaign, preview };
  }

  return { campaign, preview };
}

export async function queueOutreachCampaignChunk(campaignId: string): Promise<{
  queuedSms: number;
  queuedEmail: number;
  done: boolean;
}> {
  const campaign = await loadCampaignAdmin(campaignId);
  if (campaign.status !== "queuing" && campaign.status !== "planning") {
    return { queuedSms: 0, queuedEmail: 0, done: true };
  }

  const businessId = campaign.businessId;
  const supabase = createAdminClient();

  const { data: businessRow, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (!businessRow) throw new Error("Business not found");

  const { businessRecordToClientConfig } = await import("@/audit/businesses");
  const business = businessRecordToClientConfig(businessRow);

  const reviewUrl = resolveReviewUrl(business);
  if (!reviewUrl) {
    await supabase
      .from("outreach_campaigns")
      .update({
        status: "failed",
        error_message: "missing_review_url",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
    return { queuedSms: 0, queuedEmail: 0, done: true };
  }

  const rawAudit = await loadLatestAuditFromSupabase(campaign.userId, business.id, {
    businessName: business.name,
    businessUuid: businessId,
  });
  const audit = rawAudit ? ensureStrategy(rawAudit) : null;
  const keywordGrids =
    audit && businessId ? await loadKeywordGridsForAudit(businessId, audit) : new Map();

  const slice = campaign.plannedEntries.slice(
    campaign.queueOffset,
    campaign.queueOffset + CAMPAIGN_QUEUE_CHUNK_SIZE
  );

  if (slice.length === 0) {
    await supabase
      .from("outreach_campaigns")
      .update({ status: "active", completed_at: null })
      .eq("id", campaignId);
    return { queuedSms: 0, queuedEmail: 0, done: true };
  }

  const customerIds = slice.map((entry) => entry.customerId);
  const { data: customerRows, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .in("id", customerIds);

  if (customerError) throw new Error(customerError.message);

  const customersById = new Map(
    (customerRows ?? []).map((row) => [row.id as string, row as unknown as CustomerRecord])
  );

  const spreadStart = new Date(campaign.spreadStartAt);
  let queuedSms = 0;
  let queuedEmail = 0;

  for (const entry of slice) {
    const customer = customersById.get(entry.customerId);
    if (!customer) continue;

    const sendAt = scheduleAtForIndex(entry.scheduleIndex, campaign.dailySendCap, spreadStart);
    const geoRouting =
      audit && keywordGrids.size > 0
        ? (
            await routeCustomerGeoReview({
              businessId,
              business,
              customer,
              audit,
              keywordGrids,
              checkCellCap: false,
            })
          ).geoRouting
        : null;

    if (entry.sendEmail && campaign.emailTemplate) {
      const toEmail = normalizeEmail(customer.email ?? "");
      if (toEmail) {
        const content = buildReviewEmailContent({
          subjectTemplate: campaign.emailSubject ?? "How was your experience with [BUSINESS]?",
          bodyTemplate: campaign.emailTemplate,
          customer,
          businessName: business.name,
          reviewUrl,
          unsubscribeUrl: buildUnsubscribeUrl(customer.id, businessId),
          focusKeyword: geoRouting?.focusKeyword ?? campaign.focusKeyword,
          neighborhoodLabel: geoRouting?.neighborhoodLabel ?? null,
          location: {
            city: business.location.city,
            state: business.location.state,
          },
        });

        await scheduleReviewRequestEmail({
          userId: campaign.userId,
          businessId,
          customerId: customer.id,
          toEmail,
          subject: content.subject,
          bodyText: content.bodyText,
          bodyHtml: content.bodyHtml,
          sendAt,
          focusKeyword: geoRouting?.focusKeyword ?? campaign.focusKeyword,
          geoRouting,
          outreachCampaignId: campaignId,
        });
        queuedEmail++;
      }
    }

    if (entry.sendSms) {
      const phone = customer.phone ? normalizePhoneE164(customer.phone) : null;
      if (phone) {
        const body = personalizeReviewRequestSms({
          template: campaign.smsTemplate,
          customer,
          businessName: business.name,
          reviewUrl,
          focusKeyword: geoRouting?.focusKeyword ?? campaign.focusKeyword,
          neighborhoodLabel: geoRouting?.neighborhoodLabel ?? null,
          location: {
            city: business.location.city,
            state: business.location.state,
          },
        });

        await scheduleReviewRequestSms({
          userId: campaign.userId,
          businessId,
          customerId: customer.id,
          toPhone: phone,
          body,
          sendAt,
          focusKeyword: geoRouting?.focusKeyword ?? campaign.focusKeyword,
          geoRouting,
          outreachCampaignId: campaignId,
        });
        queuedSms++;
      }
    }
  }

  const nextOffset = campaign.queueOffset + slice.length;
  const done = nextOffset >= campaign.plannedEntries.length;

  await supabase
    .from("outreach_campaigns")
    .update({
      status: done ? "active" : "queuing",
      queue_offset: nextOffset,
      queued_sms_count: campaign.queuedSmsCount + queuedSms,
      queued_email_count: campaign.queuedEmailCount + queuedEmail,
      completed_at: done ? null : null,
    })
    .eq("id", campaignId);

  return { queuedSms, queuedEmail, done };
}

export async function cancelOutreachCampaign(campaignId: string, userId: string): Promise<void> {
  const supabase = createAdminClient();
  const campaign = await getOutreachCampaign(campaignId, userId);
  if (!campaign) throw new Error("Campaign not found");

  await supabase
    .from("sms_messages")
    .update({ status: "cancelled", error_message: "campaign_cancelled" })
    .eq("outreach_campaign_id", campaignId)
    .eq("status", "scheduled");

  await supabase
    .from("email_messages")
    .update({ status: "cancelled", error_message: "campaign_cancelled" })
    .eq("outreach_campaign_id", campaignId)
    .eq("status", "scheduled");

  await supabase
    .from("outreach_campaigns")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("user_id", userId);
}

export async function refreshOutreachCampaignStats(campaignId: string): Promise<void> {
  const supabase = createAdminClient();

  const { count: smsSent } = await supabase
    .from("sms_messages")
    .select("id", { count: "exact", head: true })
    .eq("outreach_campaign_id", campaignId)
    .in("status", ["sent", "simulated"]);

  const { count: emailSent } = await supabase
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("outreach_campaign_id", campaignId)
    .in("status", ["sent", "simulated"]);

  const { count: smsFailed } = await supabase
    .from("sms_messages")
    .select("id", { count: "exact", head: true })
    .eq("outreach_campaign_id", campaignId)
    .eq("status", "failed");

  const { count: emailFailed } = await supabase
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("outreach_campaign_id", campaignId)
    .eq("status", "failed");

  const { count: smsScheduled } = await supabase
    .from("sms_messages")
    .select("id", { count: "exact", head: true })
    .eq("outreach_campaign_id", campaignId)
    .eq("status", "scheduled");

  const { count: emailScheduled } = await supabase
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("outreach_campaign_id", campaignId)
    .eq("status", "scheduled");

  const sentCount = (smsSent ?? 0) + (emailSent ?? 0);
  const failedCount = (smsFailed ?? 0) + (emailFailed ?? 0);
  const pending = (smsScheduled ?? 0) + (emailScheduled ?? 0);

  const patch: Record<string, unknown> = {
    sent_count: sentCount,
    failed_count: failedCount,
  };
  if (pending === 0 && sentCount + failedCount > 0) {
    patch.status = "completed";
    patch.completed_at = new Date().toISOString();
  }

  await supabase.from("outreach_campaigns").update(patch).eq("id", campaignId);
}

export async function processDueOutreachCampaignQueues(): Promise<{
  processed: number;
  completed: number;
  failed: number;
}> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("outreach_campaigns")
    .select("id")
    .eq("status", "queuing")
    .order("created_at", { ascending: true })
    .limit(CAMPAIGN_QUEUE_JOBS_PER_CRON);

  if (error) throw new Error(error.message);

  const result = { processed: 0, completed: 0, failed: 0 };

  for (const row of data ?? []) {
    result.processed++;
    try {
      let done = false;
      for (let chunk = 0; chunk < 3 && !done; chunk++) {
        const chunkResult = await queueOutreachCampaignChunk(row.id as string);
        done = chunkResult.done;
      }
      if (done) result.completed++;
      await refreshOutreachCampaignStats(row.id as string);
    } catch {
      await supabase
        .from("outreach_campaigns")
        .update({
          status: "failed",
          error_message: "queue_chunk_failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      result.failed++;
    }
  }

  return result;
}
