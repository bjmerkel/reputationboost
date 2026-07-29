import { createAdminClient } from "@/lib/supabase/admin";
import { REVIEW_REQUEST_COOLDOWN_DAYS } from "@/lib/review-requests/eligibility";
import { upsertCustomerRecord } from "@/lib/customers/upsert-customer";
import type { CustomerInput, CustomerRecord } from "./types";

function rowToRecord(row: Record<string, unknown>): CustomerRecord {
  return row as unknown as CustomerRecord;
}

export async function upsertCustomerAdmin(
  userId: string,
  businessId: string,
  input: CustomerInput
): Promise<CustomerRecord> {
  const supabase = createAdminClient();
  return upsertCustomerRecord(supabase, userId, businessId, input);
}

export async function getCustomersByIdsAdmin(
  businessId: string,
  customerIds: string[]
): Promise<CustomerRecord[]> {
  if (customerIds.length === 0) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .in("id", customerIds);

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToRecord);
}

export async function getEligibleCustomersAdmin(
  businessId: string,
  limit: number
): Promise<CustomerRecord[]> {
  const supabase = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REVIEW_REQUEST_COOLDOWN_DAYS);

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .eq("opted_out", false)
    .or(`review_requested_at.is.null,review_requested_at.lt.${cutoff.toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToRecord);
}

export async function logSmsMessageAdmin(
  userId: string,
  input: {
    businessId: string;
    customerId?: string;
    executionTaskId?: string;
    focusKeyword?: string | null;
    targetGridNorth?: number | null;
    targetGridEast?: number | null;
    targetZone?: string | null;
    neighborhoodLabel?: string | null;
    toPhone: string;
    body: string;
    status: "pending" | "sent" | "failed" | "simulated";
    providerSid?: string;
    errorMessage?: string;
  }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("sms_messages").insert({
    business_id: input.businessId,
    user_id: userId,
    customer_id: input.customerId ?? null,
    execution_task_id: input.executionTaskId ?? null,
    focus_keyword: input.focusKeyword ?? null,
    target_grid_north: input.targetGridNorth ?? null,
    target_grid_east: input.targetGridEast ?? null,
    target_zone: input.targetZone ?? null,
    neighborhood_label: input.neighborhoodLabel ?? null,
    to_phone: input.toPhone,
    body: input.body,
    status: input.status,
    provider_sid: input.providerSid ?? null,
    error_message: input.errorMessage ?? null,
    sent_at:
      input.status === "sent" || input.status === "simulated"
        ? new Date().toISOString()
        : null,
  });

  if (error) throw new Error(error.message);
}

export async function markCustomersReviewRequestedAdmin(
  businessId: string,
  customerIds: string[]
): Promise<void> {
  if (customerIds.length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("customers")
    .update({
      review_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .in("id", customerIds);

  if (error) throw new Error(error.message);
}

export async function logEmailMessageAdmin(
  userId: string,
  input: {
    businessId: string;
    customerId?: string;
    executionTaskId?: string;
    focusKeyword?: string | null;
    targetGridNorth?: number | null;
    targetGridEast?: number | null;
    targetZone?: string | null;
    neighborhoodLabel?: string | null;
    toEmail: string;
    subject: string;
    bodyText: string;
    bodyHtml: string;
    status: "pending" | "sent" | "failed" | "simulated";
    providerMessageId?: string;
    errorMessage?: string;
  }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("email_messages").insert({
    business_id: input.businessId,
    user_id: userId,
    customer_id: input.customerId ?? null,
    execution_task_id: input.executionTaskId ?? null,
    focus_keyword: input.focusKeyword ?? null,
    target_grid_north: input.targetGridNorth ?? null,
    target_grid_east: input.targetGridEast ?? null,
    target_zone: input.targetZone ?? null,
    neighborhood_label: input.neighborhoodLabel ?? null,
    to_email: input.toEmail,
    subject: input.subject,
    body_text: input.bodyText,
    body_html: input.bodyHtml,
    status: input.status,
    provider_message_id: input.providerMessageId ?? null,
    error_message: input.errorMessage ?? null,
    sent_at:
      input.status === "sent" || input.status === "simulated"
        ? new Date().toISOString()
        : null,
  });

  if (error) throw new Error(error.message);
}

export async function optOutCustomerAdmin(customerId: string, businessId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("customers")
    .update({
      opted_out: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId)
    .eq("business_id", businessId);

  if (error) throw new Error(error.message);
}
