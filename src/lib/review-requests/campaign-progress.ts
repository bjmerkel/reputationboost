import type { FullAuditPayload } from "@/audit/types";
import type { ReviewKeywordCampaign } from "@/lib/review-requests/campaign-storage";
import {
  countReviewMentionsForKeyword,
  countReviewMentionsSince,
} from "@/lib/review-requests/campaign-plan";

export interface CampaignProgress {
  keyword: string;
  campaignId: string;
  status: string;
  startedAt: string;
  targetReviews: number;
  baselineMentionCount: number;
  newMentionsSinceStart: number;
  attributedReviews: number;
  effectiveMentions: number;
  reviewsRemaining: number;
  progressPercent: number;
  isComplete: boolean;
}

export function getCampaignProgress(
  audit: FullAuditPayload,
  campaign: ReviewKeywordCampaign
): CampaignProgress {
  const targetReviews = campaign.target_reviews ?? 5;
  const newMentionsSinceStart = countReviewMentionsSince(
    audit,
    campaign.keyword,
    campaign.started_at
  );
  const totalMentions = countReviewMentionsForKeyword(audit, campaign.keyword);
  const effectiveMentions = Math.max(
    newMentionsSinceStart,
    totalMentions - campaign.baseline_mention_count
  );
  const attributedReviews = campaign.attributed_reviews;
  const combinedProgress = Math.max(effectiveMentions, attributedReviews);
  const reviewsRemaining = Math.max(0, targetReviews - combinedProgress);
  const progressPercent =
    targetReviews > 0 ? Math.min(100, Math.round((combinedProgress / targetReviews) * 100)) : 100;
  const isComplete = reviewsRemaining <= 0;

  return {
    keyword: campaign.keyword,
    campaignId: campaign.id,
    status: campaign.status,
    startedAt: campaign.started_at,
    targetReviews,
    baselineMentionCount: campaign.baseline_mention_count,
    newMentionsSinceStart,
    attributedReviews,
    effectiveMentions: combinedProgress,
    reviewsRemaining,
    progressPercent,
    isComplete,
  };
}

export function isCampaignTargetMet(
  audit: FullAuditPayload,
  campaign: ReviewKeywordCampaign
): boolean {
  return getCampaignProgress(audit, campaign).isComplete;
}

export interface CampaignDashboardRow extends CampaignProgress {
  completedAt?: string | null;
}

export function buildCampaignDashboardRows(
  audit: FullAuditPayload,
  campaigns: ReviewKeywordCampaign[]
): CampaignDashboardRow[] {
  return campaigns.map((campaign) => {
    const progress = getCampaignProgress(audit, campaign);
    return {
      ...progress,
      status: campaign.status,
      completedAt: campaign.status === "completed" ? campaign.updated_at : null,
    };
  });
}
