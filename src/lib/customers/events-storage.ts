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

export interface CustomerEventListOptions {
  limit?: number;
  offset?: number;
  eventType?: string;
  source?: string;
  reviewRequestSent?: boolean;
  optedOutOnly?: boolean;
}

export interface SmsListOptions {
  limit?: number;
  offset?: number;
  status?: string;
}

function mapCustomerEventRow(row: Record<string, unknown>): CustomerEventRecord {
  const customer = row.customers as CustomerEventRecord["customer"];
  return {
    id: row.id as string,
    business_id: row.business_id as string,
    customer_id: row.customer_id as string | null,
    event_type: row.event_type as string,
    source: row.source as string,
    external_id: row.external_id as string | null,
    occurred_at: row.occurred_at as string,
    review_request_sent: row.review_request_sent as boolean,
    created_at: row.created_at as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    customer: customer ?? null,
  };
}

export async function listCustomerEvents(
  userId: string,
  businessId: string,
  options: CustomerEventListOptions = {}
): Promise<{ events: CustomerEventRecord[]; total: number }> {
  const supabase = await createClient();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let query = supabase
    .from("customer_events")
    .select(
      "id, business_id, customer_id, event_type, source, external_id, occurred_at, review_request_sent, created_at, payload, customers(first_name, last_name, phone)",
      { count: "exact" }
    )
    .eq("user_id", userId)
    .eq("business_id", businessId);

  if (options.eventType) {
    query = query.eq("event_type", options.eventType);
  }
  if (options.source) {
    query = query.eq("source", options.source);
  }
  if (options.reviewRequestSent === true) {
    query = query.eq("review_request_sent", true);
  } else if (options.reviewRequestSent === false) {
    query = query.eq("review_request_sent", false);
  }
  if (options.optedOutOnly) {
    query = query.or(
      "event_type.eq.customer.opted_out,event_type.eq.sms.opt_out,event_type.eq.do_not_contact"
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  let events = (data ?? []).map((row) => mapCustomerEventRow(row as Record<string, unknown>));

  if (options.optedOutOnly) {
    events = events.filter(
      (event) =>
        event.payload.optedOut === true ||
        ["customer.opted_out", "sms.opt_out", "do_not_contact"].includes(event.event_type)
    );
  }

  return { events, total: count ?? events.length };
}

export async function listRecentSmsMessages(
  userId: string,
  businessId: string,
  options: SmsListOptions = {}
) {
  const supabase = await createClient();
  const limit = options.limit ?? 30;
  const offset = options.offset ?? 0;

  let query = supabase
    .from("sms_messages")
    .select(
      "id, customer_id, to_phone, status, sent_at, scheduled_at, error_message, created_at, customers(first_name, last_name)",
      { count: "exact" }
    )
    .eq("user_id", userId)
    .eq("business_id", businessId);

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return { sms: data ?? [], total: count ?? 0 };
}

export async function listEventFilterOptions(userId: string, businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_events")
    .select("event_type, source")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const eventTypes = [...new Set((data ?? []).map((row) => row.event_type as string))].sort();
  const sources = [...new Set((data ?? []).map((row) => row.source as string))].sort();
  return { eventTypes, sources };
}
