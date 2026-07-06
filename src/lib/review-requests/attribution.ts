import type { BusinessRecord } from "@/audit/businesses";
import { createAdminClient } from "@/lib/supabase/admin";

export const ATTRIBUTION_WINDOW_DAYS = 14;

export interface OutreachAttributionInput {
  businessId: string;
  userId: string;
  reviewDetectedAt?: string;
  reviewAuthor?: string;
  reviewRating?: number;
  attributionMethod?: string;
}

export interface OutreachAttributionRecord {
  id: string;
  business_id: string;
  customer_id: string | null;
  sms_message_id: string | null;
  review_author: string | null;
  review_rating: number | null;
  review_detected_at: string;
  attribution_method: string;
}

interface SentSmsCandidate {
  id: string;
  customer_id: string | null;
  sent_at: string;
  customers?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

function normalizeLocationToken(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/locations\/([^/]+)$/);
  return match?.[1] ?? trimmed;
}

export function parseReviewIdFromReviewName(reviewName: string): string | null {
  const trimmed = reviewName.trim();
  const match = trimmed.match(/reviews\/([^/]+)$/);
  return match?.[1] ?? null;
}

export function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatchForAttribution(
  reviewerName: string,
  firstName: string,
  lastName: string
): boolean {
  const reviewer = normalizePersonName(reviewerName);
  if (!reviewer || reviewer === "anonymous" || reviewer === "a google user") {
    return false;
  }

  const customerFull = normalizePersonName(`${firstName} ${lastName}`.trim());
  if (!customerFull) return false;
  if (reviewer === customerFull) return true;

  const first = normalizePersonName(firstName);
  const last = normalizePersonName(lastName);
  if (first && last && reviewer.includes(first) && reviewer.includes(last)) return true;
  if (first && reviewer.split(" ")[0] === first && last && reviewer.endsWith(last)) return true;

  return false;
}

export function pickAttributionCandidate(
  messages: SentSmsCandidate[],
  attributedSmsIds: Set<string>,
  reviewAuthor?: string
): { candidate: SentSmsCandidate; method: string } | null {
  const available = messages.filter((row) => !attributedSmsIds.has(row.id));
  if (!available.length) return null;

  if (reviewAuthor?.trim()) {
    const nameMatch = available.find((row) => {
      const customer = row.customers;
      if (!customer) return false;
      return namesMatchForAttribution(
        reviewAuthor,
        customer.first_name ?? "",
        customer.last_name ?? ""
      );
    });
    if (nameMatch) {
      return { candidate: nameMatch, method: "name_match" };
    }
  }

  return { candidate: available[0], method: "time_window" };
}

export async function findBusinessByGbpLocation(
  locationName: string
): Promise<{ businessId: string; userId: string } | null> {
  const record = await findBusinessRecordByGbpLocation(locationName);
  if (!record) return null;
  return { businessId: record.id, userId: record.user_id };
}

export async function findBusinessRecordByGbpLocation(
  locationName: string
): Promise<BusinessRecord | null> {
  const supabase = createAdminClient();
  const token = normalizeLocationToken(locationName);

  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .or(`gbp_location_id.eq.${token},gbp_location_id.eq.${locationName}`)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as BusinessRecord) ?? null;
}

async function findRecentCustomerEventId(
  businessId: string,
  customerId: string,
  beforeIso: string
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_events")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .lte("created_at", beforeIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.id as string) ?? null;
}

export async function attributeReviewToRecentOutreach(
  input: OutreachAttributionInput
): Promise<OutreachAttributionRecord | null> {
  const supabase = createAdminClient();
  const detectedAt = input.reviewDetectedAt ?? new Date().toISOString();
  const windowStart = new Date(detectedAt);
  windowStart.setDate(windowStart.getDate() - ATTRIBUTION_WINDOW_DAYS);

  const { data: sentMessages, error: smsError } = await supabase
    .from("sms_messages")
    .select("id, customer_id, sent_at, customers(first_name, last_name)")
    .eq("business_id", input.businessId)
    .in("status", ["sent", "simulated"])
    .gte("sent_at", windowStart.toISOString())
    .lte("sent_at", detectedAt)
    .order("sent_at", { ascending: false })
    .limit(20);

  if (smsError) throw new Error(smsError.message);
  if (!sentMessages?.length) return null;

  const { data: existing } = await supabase
    .from("review_outreach_attributions")
    .select("sms_message_id")
    .eq("business_id", input.businessId)
    .in(
      "sms_message_id",
      sentMessages.map((row) => row.id as string)
    );

  const attributed = new Set((existing ?? []).map((row) => row.sms_message_id as string));
  const candidates: SentSmsCandidate[] = (sentMessages ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const customer = record.customers as SentSmsCandidate["customers"];
    return {
      id: record.id as string,
      customer_id: record.customer_id as string | null,
      sent_at: record.sent_at as string,
      customers: Array.isArray(customer) ? (customer[0] ?? null) : (customer ?? null),
    };
  });
  const picked = pickAttributionCandidate(candidates, attributed, input.reviewAuthor);
  if (!picked) return null;

  const { candidate, method } = picked;
  const attributionMethod = input.attributionMethod
    ? method === "name_match"
      ? `${input.attributionMethod}+name_match`
      : input.attributionMethod
    : method;

  let customerEventId: string | null = null;
  if (candidate.customer_id && candidate.sent_at) {
    customerEventId = await findRecentCustomerEventId(
      input.businessId,
      candidate.customer_id,
      candidate.sent_at
    );
  }

  const { data, error } = await supabase
    .from("review_outreach_attributions")
    .insert({
      business_id: input.businessId,
      user_id: input.userId,
      customer_id: candidate.customer_id,
      sms_message_id: candidate.id,
      customer_event_id: customerEventId,
      review_author: input.reviewAuthor ?? null,
      review_rating: input.reviewRating ?? null,
      review_detected_at: detectedAt,
      attribution_method: attributionMethod,
      window_days: ATTRIBUTION_WINDOW_DAYS,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as OutreachAttributionRecord;
}

export async function getOutreachStats(userId: string, businessId: string) {
  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [eventsRes, smsRes, scheduledRes, attributedRes] = await Promise.all([
    supabase
      .from("customer_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .gte("created_at", sinceIso),
    supabase
      .from("sms_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .in("status", ["sent", "simulated"])
      .gte("sent_at", sinceIso),
    supabase
      .from("sms_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .eq("status", "scheduled"),
    supabase
      .from("review_outreach_attributions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .gte("review_detected_at", sinceIso),
  ]);

  const smsSent = smsRes.count ?? 0;
  const attributed = attributedRes.count ?? 0;

  return {
    webhooks30d: eventsRes.count ?? 0,
    smsSent30d: smsSent,
    scheduledPending: scheduledRes.count ?? 0,
    attributedReviews30d: attributed,
    conversionRate: smsSent > 0 ? Math.round((attributed / smsSent) * 1000) / 10 : 0,
    windowDays: ATTRIBUTION_WINDOW_DAYS,
  };
}
