import { ATTRIBUTION_WINDOW_DAYS } from "@/lib/review-requests/attribution";
import { createAdminClient } from "@/lib/supabase/admin";
import { findRecentProfileGuideReviewClick } from "./storage-admin";

export interface ProfileGuideAttributionInput {
  businessId: string;
  userId: string;
  guideId: string;
  reviewDetectedAt?: string;
  reviewAuthor?: string;
  reviewRating?: number;
  reviewText?: string;
  reviewId?: string;
  attributionMethod?: string;
}

export async function attributeReviewToProfileGuide(
  input: ProfileGuideAttributionInput
): Promise<{ id: string } | null> {
  const supabase = createAdminClient();
  const detectedAt = input.reviewDetectedAt ?? new Date().toISOString();

  const { data: existing } = await supabase
    .from("review_outreach_attributions")
    .select("id")
    .eq("business_id", input.businessId)
    .eq("review_id", input.reviewId ?? "")
    .not("review_id", "is", null)
    .maybeSingle();

  if (existing?.id) return null;

  const click = await findRecentProfileGuideReviewClick(
    input.guideId,
    detectedAt,
    ATTRIBUTION_WINDOW_DAYS
  );

  if (!click) return null;

  const { data, error } = await supabase
    .from("review_outreach_attributions")
    .insert({
      business_id: input.businessId,
      user_id: input.userId,
      profile_guide_id: input.guideId,
      profile_guide_link_id: click.linkId,
      review_author: input.reviewAuthor ?? null,
      review_rating: input.reviewRating ?? null,
      review_detected_at: detectedAt,
      review_id: input.reviewId ?? null,
      review_text: input.reviewText ?? null,
      attribution_method: input.attributionMethod ?? "profile_guide_click",
      window_days: ATTRIBUTION_WINDOW_DAYS,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("profile_guide_id")) return null;
    throw new Error(error.message);
  }

  return data ? { id: data.id as string } : null;
}

export async function getProfileGuideIdForBusiness(businessId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profile_guides")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.id as string) ?? null;
}
