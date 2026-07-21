import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import { upsertCustomerAdmin } from "@/lib/customers/storage-admin";
import type { CustomerRecord } from "@/lib/customers/types";
import { generateReviewRequestMessage } from "@/lib/llm/review-request-sms";
import {
  auditHasReviewGap,
  evaluateReviewRequestEligibility,
  ineligibilityMessage,
} from "@/lib/review-requests/eligibility";
import { scheduleReviewRequestForCustomer } from "@/lib/review-requests/scheduled-sms";
import { prepareGeoReviewContext } from "@/lib/review-velocity/prepare-geo-review";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPrivateFeedbackTemplate } from "@/lib/sms/private-feedback";
import { sendReviewRequests } from "@/lib/sms/send-review-requests";
import { inferWebhookServiceNotes } from "./webhook-service";
import { isOptOutEvent, normalizeWebhookPayload } from "./normalize-webhook-payload";
import {
  getBusinessConfigForWebhook,
  getWebhookBusinessByToken,
} from "./webhook-storage";
import type { WebhookProcessResult } from "./webhook-types";

function buildDefaultTemplate(_businessName: string): string {
  return `Hi [FIRST_NAME]! Thanks for choosing [BUSINESS] for [SERVICE]. We'd love your feedback on Google — it helps neighbors find us: [REVIEW_LINK]`;
}

function readSentiment(
  payload: Record<string, unknown>
): "positive" | "neutral" | "negative" | undefined {
  const raw = payload.sentiment ?? payload.customerSentiment ?? payload.rating_sentiment;
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "positive" || value === "neutral" || value === "negative") return value;
  if (value === "bad" || value === "unhappy") return "negative";
  return undefined;
}

async function logCustomerEvent(input: {
  businessId: string;
  userId: string;
  customerId: string;
  eventType: string;
  source: string;
  externalId?: string;
  payload: Record<string, unknown>;
  occurredAt?: string;
  reviewRequestSent: boolean;
  reviewRequestScheduled: boolean;
}): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_events")
    .insert({
      business_id: input.businessId,
      user_id: input.userId,
      customer_id: input.customerId,
      event_type: input.eventType,
      source: input.source,
      external_id: input.externalId ?? null,
      payload: {
        ...input.payload,
        reviewRequestScheduled: input.reviewRequestScheduled,
      },
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      review_request_sent: input.reviewRequestSent,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function updateCustomerEventMetadata(
  customer: CustomerRecord,
  eventType: string,
  externalId: string | undefined,
  source: string
): Promise<CustomerRecord> {
  const externalIds = {
    ...(customer.external_ids ?? {}),
    ...(externalId ? { [source]: externalId } : {}),
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .update({
      external_ids: externalIds,
      last_event_at: new Date().toISOString(),
      last_event_type: eventType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customer.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as CustomerRecord;
}

async function applyOptPreference(
  customer: CustomerRecord,
  optedOut: boolean | undefined
): Promise<{ customer: CustomerRecord; optOutApplied: boolean; optInApplied: boolean }> {
  if (optedOut === undefined) {
    return { customer, optOutApplied: false, optInApplied: false };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ opted_out: optedOut, updated_at: new Date().toISOString() })
    .eq("id", customer.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return {
    customer: data as CustomerRecord,
    optOutApplied: optedOut === true,
    optInApplied: optedOut === false,
  };
}

export async function processInboundWebhook(
  token: string,
  rawBody: unknown
): Promise<WebhookProcessResult> {
  const settings = await getWebhookBusinessByToken(token);
  if (!settings) {
    throw new Error("Invalid webhook token");
  }

  const payload = normalizeWebhookPayload(rawBody);
  const business = await getBusinessConfigForWebhook(settings);

  const rawAudit = await loadLatestAuditForBusinessAdmin(
    settings.userId,
    settings.businessId,
    business.id,
    business.name
  );
  const audit = rawAudit ? ensureStrategy(rawAudit) : null;

  const serviceNotes = inferWebhookServiceNotes(payload, audit) ?? payload.service;

  let customer = await upsertCustomerAdmin(settings.userId, settings.businessId, {
    firstName: payload.firstName,
    lastName: payload.lastName,
    phone: payload.phone,
    email: payload.email,
    serviceNotes,
    lastServiceDate: payload.serviceDate,
    source: payload.source ?? "webhook",
  });

  const { customer: updatedCustomer, optOutApplied, optInApplied } = await applyOptPreference(
    customer,
    payload.optedOut
  );
  customer = updatedCustomer;

  customer = await updateCustomerEventMetadata(
    customer,
    payload.event,
    payload.externalId,
    payload.source ?? "webhook"
  );

  const isOptOut = isOptOutEvent(payload.event) || payload.optedOut === true;

  if (isOptOut) {
    const eventId = await logCustomerEvent({
      businessId: settings.businessId,
      userId: settings.userId,
      customerId: customer.id,
      eventType: payload.event,
      source: payload.source ?? "webhook",
      externalId: payload.externalId,
      payload: {
        ...(payload as unknown as Record<string, unknown>),
        optedOut: true,
      },
      occurredAt: payload.serviceDate,
      reviewRequestSent: false,
      reviewRequestScheduled: false,
    });

    return {
      ok: true,
      customerId: customer.id,
      eventId,
      eventType: payload.event,
      reviewRequestSent: false,
      reviewRequestScheduled: false,
      optedOut: true,
      optOutApplied,
      optInApplied,
      reviewRequestSkippedReason: "Customer opted out of review requests.",
    };
  }

  const hasReviewGap = auditHasReviewGap(audit);
  const sentiment = readSentiment(payload as unknown as Record<string, unknown>);

  const geoContext = await prepareGeoReviewContext({
    userId: settings.userId,
    businessId: settings.businessId,
    business,
    customer,
    audit,
    webhookGeo: {
      jobAddress: payload.jobAddress,
      jobCity: payload.jobCity,
      jobZip: payload.jobZip,
      jobLat: payload.jobLat,
      jobLng: payload.jobLng,
    },
  });
  customer = geoContext.customer;

  const eligibility = evaluateReviewRequestEligibility({
    customer,
    eventType: payload.event,
    explicitSend: payload.sendReviewRequest,
    autoSend: settings.autoSend,
    triggerEvents: settings.triggerEvents,
    auditHasReviewGap: hasReviewGap,
    sentiment,
    hasPrivateFeedbackUrl: Boolean(business.privateFeedbackUrl),
  });

  let reviewRequestSent = false;
  let reviewRequestScheduled = false;
  let scheduledAt: string | undefined;
  let scheduledSmsId: string | undefined;
  let reviewRequestSkippedReason = eligibility.reason
    ? ineligibilityMessage(eligibility.reason)
    : undefined;
  let geoRouting = geoContext.geoRouting;

  if (eligibility.eligible && geoContext.geoDeferred) {
    reviewRequestSkippedReason =
      "Weekly review request cap reached for this map area. Will retry on the next eligible job.";
  }

  if (eligibility.eligible && !geoContext.geoDeferred) {
    const usePrivateFeedback = eligibility.usePrivateFeedback === true;
    const reviewUrlOverride = usePrivateFeedback ? business.privateFeedbackUrl : undefined;

    if (usePrivateFeedback && !reviewUrlOverride) {
      reviewRequestSkippedReason = "Private feedback URL is not configured.";
    } else {
      const focusKeyword = geoContext.focusKeyword;
      const template = usePrivateFeedback
        ? buildPrivateFeedbackTemplate(business.name)
        : audit
          ? await generateReviewRequestMessage(audit, customer, focusKeyword, geoRouting ?? undefined)
          : buildDefaultTemplate(business.name);

      if (settings.delayHours > 0) {
        const scheduled = await scheduleReviewRequestForCustomer({
          userId: settings.userId,
          business,
          customer,
          template,
          delayHours: settings.delayHours,
          reviewUrlOverride,
          focusKeyword,
          geoRouting,
        });

        if (scheduled.scheduled) {
          reviewRequestScheduled = true;
          scheduledAt = scheduled.scheduledAt;
          scheduledSmsId = scheduled.smsId;
          reviewRequestSkippedReason = undefined;
        } else {
          reviewRequestSkippedReason = scheduled.reason ?? "schedule_failed";
        }
      } else {
        const result = await sendReviewRequests({
          userId: settings.userId,
          business,
          template,
          customerIds: [customer.id],
          focusKeyword,
          geoRouting,
          serviceRole: true,
          reviewUrlOverride,
        });

        reviewRequestSent = result.sent > 0;
        if (!reviewRequestSent) {
          reviewRequestSkippedReason = result.messages[0]?.error ?? "send_failed";
        } else {
          reviewRequestSkippedReason = undefined;
        }
      }
    }
  }

  const eventId = await logCustomerEvent({
    businessId: settings.businessId,
    userId: settings.userId,
    customerId: customer.id,
    eventType: payload.event,
    source: payload.source ?? "webhook",
    externalId: payload.externalId,
    payload: {
      ...(payload as unknown as Record<string, unknown>),
      sentiment,
      usedPrivateFeedback: eligibility.usePrivateFeedback === true,
      optedOut: payload.optedOut ?? false,
      geoRouting: geoRouting
        ? {
            focusKeyword: geoRouting.focusKeyword,
            targetZone: geoRouting.targetZone,
            neighborhoodLabel: geoRouting.neighborhoodLabel,
            weaknessScore: geoRouting.weaknessScore,
            geoTargeted: geoRouting.geoTargeted,
            geoDeferred: geoContext.geoDeferred,
            geoDeferReason: geoContext.geoDeferReason,
          }
        : null,
    },
    occurredAt: payload.serviceDate,
    reviewRequestSent,
    reviewRequestScheduled,
  });

  return {
    ok: true,
    customerId: customer.id,
    eventId,
    eventType: payload.event,
    reviewRequestSent,
    reviewRequestScheduled,
    scheduledAt,
    scheduledSmsId,
    auditHasReviewGap: hasReviewGap,
    reviewRequestSkippedReason,
    optedOut: customer.opted_out,
    optOutApplied,
    optInApplied,
    geoRouting: geoRouting
      ? {
          focusKeyword: geoRouting.focusKeyword,
          targetZone: geoRouting.targetZone,
          neighborhoodLabel: geoRouting.neighborhoodLabel,
          weaknessScore: geoRouting.weaknessScore,
          geoTargeted: geoRouting.geoTargeted,
        }
      : undefined,
  };
}
