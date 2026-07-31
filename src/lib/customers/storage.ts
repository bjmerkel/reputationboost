import { bulkImportCustomers } from "@/lib/customers/bulk-upsert";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_REQUEST_COOLDOWN_DAYS } from "@/lib/review-requests/eligibility";
import { upsertCustomerRecord } from "@/lib/customers/upsert-customer";
import type {
  CustomerInput,
  CustomerListOptions,
  CustomerRecord,
  ImportCustomerRow,
} from "./types";

function rowToRecord(row: Record<string, unknown>): CustomerRecord {
  return row as unknown as CustomerRecord;
}

function formatCustomerStorageError(message: string): string {
  if (
    message.includes("Could not find the table") ||
    message.includes('relation "public.customers" does not exist') ||
    message.includes("webhook_token")
  ) {
    if (message.includes("webhook_token")) {
      return "Webhook columns not found. Run migration 020_webhook_integrations.sql in Supabase.";
    }
    return "Customers table not found. Run migration 019_customers_and_sms.sql in Supabase.";
  }
  return message;
}

export async function listCustomers(
  userId: string,
  businessId: string,
  options: CustomerListOptions = {}
): Promise<{ customers: CustomerRecord[]; total: number }> {
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (options.eligibleOnly) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - REVIEW_REQUEST_COOLDOWN_DAYS);
    query = query
      .eq("opted_out", false)
      .or(`review_requested_at.is.null,review_requested_at.lt.${cutoff.toISOString()}`);
  }

  if (options.limit) {
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(formatCustomerStorageError(error.message));

  return {
    customers: (data ?? []).map(rowToRecord),
    total: count ?? 0,
  };
}

export async function createCustomer(
  userId: string,
  businessId: string,
  input: CustomerInput
): Promise<CustomerRecord> {
  const supabase = await createClient();
  try {
    return await upsertCustomerRecord(supabase, userId, businessId, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save customer";
    throw new Error(formatCustomerStorageError(message));
  }
}

export async function importCustomers(
  userId: string,
  businessId: string,
  rows: ImportCustomerRow[]
): Promise<{ imported: number; updated: number; failed: number }> {
  const supabase = await createClient();
  try {
    return await bulkImportCustomers(supabase, userId, businessId, rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    throw new Error(formatCustomerStorageError(message));
  }
}

export async function deleteCustomer(
  userId: string,
  businessId: string,
  customerId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("user_id", userId)
    .eq("business_id", businessId);

  if (error) throw new Error(formatCustomerStorageError(error.message));
}

export async function getCustomersByIds(
  userId: string,
  businessId: string,
  customerIds: string[]
): Promise<CustomerRecord[]> {
  if (customerIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .in("id", customerIds);

  if (error) throw new Error(formatCustomerStorageError(error.message));
  return (data ?? []).map(rowToRecord);
}

export async function getEligibleCustomers(
  userId: string,
  businessId: string,
  limit: number
): Promise<CustomerRecord[]> {
  const { customers } = await listCustomers(userId, businessId, {
    eligibleOnly: true,
    limit,
  });
  return customers;
}

export async function markCustomersReviewRequested(
  userId: string,
  businessId: string,
  customerIds: string[]
): Promise<void> {
  if (customerIds.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      review_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .in("id", customerIds);

  if (error) throw new Error(formatCustomerStorageError(error.message));
}

export interface SmsMessageInput {
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

export async function logSmsMessage(
  userId: string,
  input: SmsMessageInput
): Promise<void> {
  const supabase = await createClient();
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
    sent_at: input.status === "sent" || input.status === "simulated" ? new Date().toISOString() : null,
  });

  if (error) throw new Error(formatCustomerStorageError(error.message));
}

export interface EmailMessageInput {
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

export async function logEmailMessage(
  userId: string,
  input: EmailMessageInput
): Promise<void> {
  const supabase = await createClient();
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
    sent_at: input.status === "sent" || input.status === "simulated" ? new Date().toISOString() : null,
  });

  if (error) throw new Error(formatCustomerStorageError(error.message));
}
