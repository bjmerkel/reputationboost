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

function normalizeLocationToken(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/locations\/([^/]+)$/);
  return match?.[1] ?? trimmed;
}

export async function findBusinessByGbpLocation(
  locationName: string
): Promise<{ businessId: string; userId: string } | null> {
  const supabase = createAdminClient();
  const token = normalizeLocationToken(locationName);

  const { data, error } = await supabase
    .from("businesses")
    .select("id, user_id, gbp_location_id")
    .or(`gbp_location_id.eq.${token},gbp_location_id.eq.${locationName}`)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return { businessId: data.id as string, userId: data.user_id as string };
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
    .select("id, customer_id, sent_at")
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
  const candidate = sentMessages.find((row) => !attributed.has(row.id as string));
  if (!candidate) return null;

  const { data, error } = await supabase
    .from("review_outreach_attributions")
    .insert({
      business_id: input.businessId,
      user_id: input.userId,
      customer_id: candidate.customer_id,
      sms_message_id: candidate.id,
      review_author: input.reviewAuthor ?? null,
      review_rating: input.reviewRating ?? null,
      review_detected_at: detectedAt,
      attribution_method: input.attributionMethod ?? "time_window",
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
