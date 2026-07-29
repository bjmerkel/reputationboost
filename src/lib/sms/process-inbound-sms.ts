import { createAdminClient } from "@/lib/supabase/admin";
import type { CustomerRecord } from "@/lib/customers/types";
import { normalizePhoneE164 } from "./phone";
import { parseSmsPreferenceReply } from "./opt-out-keywords";

export interface ProcessInboundSmsInput {
  fromPhone: string;
  body: string;
  messageSid?: string;
}

export interface ProcessInboundSmsResult {
  handled: boolean;
  preference: "opt_out" | "opt_in" | null;
  customerId?: string;
  businessId?: string;
  reason?: string;
}

function rowToCustomer(row: Record<string, unknown>): CustomerRecord {
  return row as unknown as CustomerRecord;
}

async function findCustomerForInboundSms(phone: string): Promise<CustomerRecord | null> {
  const supabase = createAdminClient();

  const { data: recentMessage, error: messageError } = await supabase
    .from("sms_messages")
    .select("customer_id, business_id")
    .eq("to_phone", phone)
    .in("status", ["sent", "simulated"])
    .not("customer_id", "is", null)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (messageError) throw new Error(messageError.message);

  if (recentMessage?.customer_id) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", recentMessage.customer_id as string)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return rowToCustomer(data);
  }

  const { data: customers, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (customerError) throw new Error(customerError.message);
  return customers?.[0] ? rowToCustomer(customers[0]) : null;
}

async function applyCustomerPreference(
  customer: CustomerRecord,
  optedOut: boolean,
  input: ProcessInboundSmsInput
): Promise<ProcessInboundSmsResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ opted_out: optedOut, updated_at: new Date().toISOString() })
    .eq("id", customer.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const eventType = optedOut ? "customer.opted_out" : "customer.opted_in";
  const { error: eventError } = await supabase.from("customer_events").insert({
    business_id: customer.business_id,
    user_id: customer.user_id,
    customer_id: customer.id,
    event_type: eventType,
    source: "twilio",
    external_id: input.messageSid ?? null,
    payload: {
      fromPhone: input.fromPhone,
      body: input.body,
      optedOut,
    },
    occurred_at: new Date().toISOString(),
    review_request_sent: false,
  });

  if (eventError) throw new Error(eventError.message);

  return {
    handled: true,
    preference: optedOut ? "opt_out" : "opt_in",
    customerId: (data as CustomerRecord).id,
    businessId: (data as CustomerRecord).business_id,
  };
}

export async function processInboundSms(
  input: ProcessInboundSmsInput
): Promise<ProcessInboundSmsResult> {
  const phone = normalizePhoneE164(input.fromPhone);
  if (!phone) {
    return { handled: false, preference: null, reason: "invalid_phone" };
  }

  const preference = parseSmsPreferenceReply(input.body);
  if (!preference) {
    return { handled: false, preference: null, reason: "not_preference_reply" };
  }

  const customer = await findCustomerForInboundSms(phone);
  if (!customer) {
    return { handled: false, preference, reason: "customer_not_found" };
  }

  if (preference === "opt_out" && customer.opted_out) {
    return {
      handled: true,
      preference,
      customerId: customer.id,
      businessId: customer.business_id,
      reason: "already_opted_out",
    };
  }

  if (preference === "opt_in" && !customer.opted_out) {
    return {
      handled: true,
      preference,
      customerId: customer.id,
      businessId: customer.business_id,
      reason: "already_opted_in",
    };
  }

  return applyCustomerPreference(customer, preference === "opt_out", {
    ...input,
    fromPhone: phone,
  });
}
