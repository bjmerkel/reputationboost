import { businessRecordToClientConfig } from "@/audit/businesses";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import type { ClientConfig } from "@/audit/types";
import {
  getCustomersByIdsAdmin,
  logSmsMessageAdmin,
  markCustomersReviewRequestedAdmin,
} from "@/lib/customers/storage-admin";
import type { CustomerRecord } from "@/lib/customers/types";
import {
  auditHasReviewGap,
  evaluateReviewRequestEligibility,
} from "@/lib/review-requests/eligibility";
import { personalizeReviewRequestSms } from "@/lib/sms/personalize";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { isTwilioConfigured, sendSms } from "@/lib/sms/twilio";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ScheduledSmsRecord {
  id: string;
  business_id: string;
  user_id: string;
  customer_id: string | null;
  to_phone: string;
  body: string;
  scheduled_at: string;
  status: string;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export async function scheduleReviewRequestSms(input: {
  userId: string;
  businessId: string;
  customerId: string;
  toPhone: string;
  body: string;
  sendAt: Date;
  customerEventId?: string;
}): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sms_messages")
    .insert({
      business_id: input.businessId,
      user_id: input.userId,
      customer_id: input.customerId,
      execution_task_id: input.customerEventId ?? null,
      to_phone: input.toPhone,
      body: input.body,
      status: "scheduled",
      scheduled_at: input.sendAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function listDueScheduledSms(limit = 50): Promise<ScheduledSmsRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sms_messages")
    .select("id, business_id, user_id, customer_id, to_phone, body, scheduled_at, status")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduledSmsRecord[];
}

async function loadBusinessConfig(businessId: string): Promise<ClientConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? businessRecordToClientConfig(data) : null;
}

export async function scheduleReviewRequestForCustomer(input: {
  userId: string;
  business: ClientConfig;
  customer: CustomerRecord;
  template: string;
  delayHours: number;
  customerEventId?: string;
  reviewUrlOverride?: string;
}): Promise<{ scheduled: boolean; scheduledAt?: string; smsId?: string; reason?: string }> {
  const businessId = input.business.businessId;
  if (!businessId) throw new Error("Business ID is required");

  const address = [
    input.business.location.address,
    input.business.location.city,
    input.business.location.state,
    input.business.location.zip,
  ]
    .filter(Boolean)
    .join(", ");

  const reviewUrl =
    input.reviewUrlOverride ??
    googleReviewUrlForBusiness({
      placeId: input.business.gbpPlaceId,
      mapsUrl: input.business.gbpMapsUrl,
      name: input.business.name,
      address,
    });

  if (!reviewUrl) {
    return { scheduled: false, reason: "missing_review_url" };
  }

  const body = personalizeReviewRequestSms({
    template: input.template,
    customer: input.customer,
    businessName: input.business.name,
    reviewUrl,
  });

  const sendAt = addHours(new Date(), Math.max(0, input.delayHours));
  const smsId = await scheduleReviewRequestSms({
    userId: input.userId,
    businessId,
    customerId: input.customer.id,
    toPhone: input.customer.phone,
    body,
    sendAt,
    customerEventId: input.customerEventId,
  });

  return { scheduled: true, scheduledAt: sendAt.toISOString(), smsId };
}

async function markScheduledMessage(
  messageId: string,
  patch: {
    status: "sent" | "failed" | "simulated";
    errorMessage?: string;
    providerSid?: string;
    toPhone?: string;
  }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sms_messages")
    .update({
      status: patch.status,
      error_message: patch.errorMessage ?? null,
      provider_sid: patch.providerSid ?? null,
      to_phone: patch.toPhone ?? undefined,
      sent_at:
        patch.status === "sent" || patch.status === "simulated"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", messageId);

  if (error) throw new Error(error.message);
}

export async function processDueScheduledSms(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const due = await listDueScheduledSms();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const message of due) {
    try {
      if (!message.customer_id) {
        await markScheduledMessage(message.id, {
          status: "failed",
          errorMessage: "Missing customer",
        });
        failed++;
        continue;
      }

      const business = await loadBusinessConfig(message.business_id);
      if (!business) {
        await markScheduledMessage(message.id, {
          status: "failed",
          errorMessage: "Business not found",
        });
        failed++;
        continue;
      }

      const customers = await getCustomersByIdsAdmin(message.business_id, [message.customer_id]);
      const customer = customers[0];
      if (!customer) {
        await markScheduledMessage(message.id, {
          status: "failed",
          errorMessage: "Customer not found",
        });
        failed++;
        continue;
      }

      const rawAudit = await loadLatestAuditForBusinessAdmin(
        message.user_id,
        message.business_id,
        business.id,
        business.name
      );
      const audit = rawAudit ? ensureStrategy(rawAudit) : null;

      const eligibility = evaluateReviewRequestEligibility({
        customer,
        manualSend: true,
        auditHasReviewGap: auditHasReviewGap(audit),
      });

      if (!eligibility.eligible) {
        await markScheduledMessage(message.id, {
          status: "failed",
          errorMessage: eligibility.reason ?? "ineligible",
        });
        skipped++;
        continue;
      }

      if (!isTwilioConfigured()) {
        await markScheduledMessage(message.id, { status: "simulated" });
        await markCustomersReviewRequestedAdmin(message.business_id, [customer.id]);
        sent++;
        continue;
      }

      const sms = await sendSms(message.to_phone, message.body);
      if (sms.success) {
        await markScheduledMessage(message.id, {
          status: "sent",
          providerSid: sms.sid,
          toPhone: sms.to,
        });
        await markCustomersReviewRequestedAdmin(message.business_id, [customer.id]);
        sent++;
      } else {
        await markScheduledMessage(message.id, {
          status: "failed",
          errorMessage: sms.error,
        });
        failed++;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "processing_failed";
      await markScheduledMessage(message.id, { status: "failed", errorMessage: errMsg });
      failed++;
    }
  }

  return { processed: due.length, sent, failed, skipped };
}
