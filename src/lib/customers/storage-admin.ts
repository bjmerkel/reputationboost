import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneE164 } from "@/lib/sms/phone";
import type { CustomerInput, CustomerRecord } from "./types";

function rowToRecord(row: Record<string, unknown>): CustomerRecord {
  return row as unknown as CustomerRecord;
}

export async function upsertCustomerAdmin(
  userId: string,
  businessId: string,
  input: CustomerInput
): Promise<CustomerRecord> {
  const phone = normalizePhoneE164(input.phone);
  if (!phone) throw new Error("Invalid phone number");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .upsert(
      {
        business_id: businessId,
        user_id: userId,
        first_name: input.firstName?.trim() ?? "",
        last_name: input.lastName?.trim() ?? "",
        phone,
        email: input.email?.trim() || null,
        service_notes: input.serviceNotes?.trim() || null,
        last_service_date: input.lastServiceDate || null,
        source: input.source ?? "webhook",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,phone" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToRecord(data);
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

export async function logSmsMessageAdmin(
  userId: string,
  input: {
    businessId: string;
    customerId?: string;
    executionTaskId?: string;
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
