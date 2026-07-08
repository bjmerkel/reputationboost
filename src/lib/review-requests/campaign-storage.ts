import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface ReviewKeywordCampaign {
  id: string;
  business_id: string;
  user_id: string;
  keyword: string;
  started_at: string;
  baseline_mention_count: number;
  target_reviews: number | null;
  attributed_reviews: number;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToCampaign(row: Record<string, unknown>): ReviewKeywordCampaign {
  return row as unknown as ReviewKeywordCampaign;
}

export async function getActiveKeywordCampaigns(
  userId: string,
  businessId: string
): Promise<ReviewKeywordCampaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_keyword_campaigns")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error) {
    if (error.message.includes("review_keyword_campaigns")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map(rowToCampaign);
}

export async function getActiveKeywordCampaignsAdmin(
  businessId: string
): Promise<ReviewKeywordCampaign[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("review_keyword_campaigns")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToCampaign);
}

export async function ensureKeywordCampaignStarted(input: {
  userId: string;
  businessId: string;
  keyword: string;
  baselineMentionCount: number;
  targetReviews?: number;
  serviceRole?: boolean;
}): Promise<ReviewKeywordCampaign | null> {
  const keyword = input.keyword.trim();
  if (!keyword) return null;

  const supabase = input.serviceRole ? createAdminClient() : await createClient();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("review_keyword_campaigns")
    .select("*")
    .eq("business_id", input.businessId)
    .eq("keyword", keyword)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) {
    if (existingError.message.includes("review_keyword_campaigns")) return null;
    throw new Error(existingError.message);
  }

  if (existing) {
    return rowToCampaign(existing as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("review_keyword_campaigns")
    .insert({
      business_id: input.businessId,
      user_id: input.userId,
      keyword,
      started_at: now,
      baseline_mention_count: input.baselineMentionCount,
      target_reviews: input.targetReviews ?? null,
      attributed_reviews: 0,
      status: "active",
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToCampaign(data as Record<string, unknown>);
}

export async function incrementCampaignAttributedReviews(
  businessId: string,
  keyword: string | null | undefined
): Promise<void> {
  const normalized = keyword?.trim();
  if (!normalized) return;

  const supabase = createAdminClient();
  const { data: campaign, error: loadError } = await supabase
    .from("review_keyword_campaigns")
    .select("id, attributed_reviews")
    .eq("business_id", businessId)
    .eq("keyword", normalized)
    .eq("status", "active")
    .maybeSingle();

  if (loadError || !campaign) return;

  const { error } = await supabase
    .from("review_keyword_campaigns")
    .update({
      attributed_reviews: (campaign.attributed_reviews as number) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id as string);

  if (error) throw new Error(error.message);
}
