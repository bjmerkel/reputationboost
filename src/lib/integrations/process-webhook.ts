import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import { upsertCustomerAdmin } from "@/lib/customers/storage-admin";
import type { CustomerRecord } from "@/lib/customers/types";
import { generateReviewRequestMessage } from "@/lib/llm/review-request-sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewRequests } from "@/lib/sms/send-review-requests";
import { isTriggerEvent, normalizeWebhookPayload } from "./normalize-webhook-payload";
import {
  getBusinessConfigForWebhook,
  getWebhookBusinessByToken,
} from "./webhook-storage";
import type { WebhookProcessResult } from "./webhook-types";

function buildDefaultTemplate(businessName: string): string {
  return `Hi [FIRST_NAME]! Thanks for choosing ${businessName} for [SERVICE]. We'd love your feedback on Google — it helps neighbors find us: [REVIEW_LINK]`;
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
      payload: input.payload,
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

function shouldSendReviewRequest(options: {
  payloadSendReviewRequest?: boolean;
  autoSend: boolean;
  eventType: string;
  triggerEvents: string[];
  customer: CustomerRecord;
}): { send: boolean; reason?: string } {
  if (options.customer.opted_out) {
    return { send: false, reason: "customer_opted_out" };
  }

  if (options.customer.review_requested_at) {
    return { send: false, reason: "already_requested" };
  }

  const explicitSend = options.payloadSendReviewRequest === true;
  const autoSend =
    options.autoSend && isTriggerEvent(options.eventType, options.triggerEvents);

  if (!explicitSend && !autoSend) {
    return { send: false, reason: "auto_send_disabled" };
  }

  return { send: true };
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

  let customer = await upsertCustomerAdmin(settings.userId, settings.businessId, {
    firstName: payload.firstName,
    lastName: payload.lastName,
    phone: payload.phone,
    email: payload.email,
    serviceNotes: payload.service,
    lastServiceDate: payload.serviceDate,
    source: payload.source ?? "webhook",
  });

  if (payload.optedOut) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("customers")
      .update({ opted_out: true, updated_at: new Date().toISOString() })
      .eq("id", customer.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    customer = data as CustomerRecord;
  }

  customer = await updateCustomerEventMetadata(
    customer,
    payload.event,
    payload.externalId,
    payload.source ?? "webhook"
  );

  const sendDecision = shouldSendReviewRequest({
    payloadSendReviewRequest: payload.sendReviewRequest,
    autoSend: settings.autoSend,
    eventType: payload.event,
    triggerEvents: settings.triggerEvents,
    customer,
  });

  let reviewRequestSent = false;
  let reviewRequestSkippedReason = sendDecision.reason;

  if (sendDecision.send) {
    const rawAudit = await loadLatestAuditForBusinessAdmin(
      settings.userId,
      settings.businessId,
      business.id,
      business.name
    );
    const audit = rawAudit ? ensureStrategy(rawAudit) : null;
    const template = audit
      ? await generateReviewRequestMessage(audit, customer)
      : buildDefaultTemplate(business.name);

    const result = await sendReviewRequests({
      userId: settings.userId,
      business,
      template,
      customerIds: [customer.id],
      serviceRole: true,
    });

    reviewRequestSent = result.sent > 0;
    if (!reviewRequestSent) {
      reviewRequestSkippedReason = result.messages[0]?.error ?? "send_failed";
    }
  }

  const eventId = await logCustomerEvent({
    businessId: settings.businessId,
    userId: settings.userId,
    customerId: customer.id,
    eventType: payload.event,
    source: payload.source ?? "webhook",
    externalId: payload.externalId,
    payload: payload as unknown as Record<string, unknown>,
    occurredAt: payload.serviceDate,
    reviewRequestSent,
  });

  return {
    ok: true,
    customerId: customer.id,
    eventId,
    eventType: payload.event,
    reviewRequestSent,
    reviewRequestSkippedReason,
  };
}
