import { createClient } from "@/lib/supabase/server";

export interface CustomerEventRecord {
  id: string;
  business_id: string;
  customer_id: string | null;
  event_type: string;
  source: string;
  external_id: string | null;
  occurred_at: string;
  review_request_sent: boolean;
  created_at: string;
  payload: Record<string, unknown>;
  customer?: {
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
}

export async function listCustomerEvents(
  userId: string,
  businessId: string,
  limit = 50
): Promise<CustomerEventRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_events")
    .select(
      "id, business_id, customer_id, event_type, source, external_id, occurred_at, review_request_sent, created_at, payload, customers(first_name, last_name, phone)"
    )
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const customer = record.customers as CustomerEventRecord["customer"];
    return {
      id: record.id as string,
      business_id: record.business_id as string,
      customer_id: record.customer_id as string | null,
      event_type: record.event_type as string,
      source: record.source as string,
      external_id: record.external_id as string | null,
      occurred_at: record.occurred_at as string,
      review_request_sent: record.review_request_sent as boolean,
      created_at: record.created_at as string,
      payload: (record.payload as Record<string, unknown>) ?? {},
      customer: customer ?? null,
    };
  });
}

export async function listRecentSmsMessages(
  userId: string,
  businessId: string,
  limit = 30
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sms_messages")
    .select(
      "id, customer_id, to_phone, status, sent_at, scheduled_at, error_message, created_at, customers(first_name, last_name)"
    )
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}
