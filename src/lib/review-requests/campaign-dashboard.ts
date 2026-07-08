import type { FullAuditPayload } from "@/audit/types";
import {
  buildCampaignDashboardRows,
  type CampaignDashboardRow,
} from "@/lib/review-requests/campaign-progress";
import { isCampaignTargetMet } from "@/lib/review-requests/campaign-progress";
import {
  completeKeywordCampaign,
  listKeywordCampaigns,
  type ReviewKeywordCampaign,
} from "@/lib/review-requests/campaign-storage";

export async function syncActiveCampaignCompletions(
  audit: FullAuditPayload,
  campaigns: ReviewKeywordCampaign[]
): Promise<void> {
  for (const campaign of campaigns) {
    if (campaign.status !== "active") continue;
    if (!isCampaignTargetMet(audit, campaign)) continue;
    await completeKeywordCampaign(campaign.id);
  }
}

export async function loadCampaignDashboard(
  userId: string,
  businessId: string,
  audit: FullAuditPayload | null
): Promise<{
  active: CampaignDashboardRow[];
  completed: CampaignDashboardRow[];
}> {
  if (!audit) {
    return { active: [], completed: [] };
  }

  const initial = await listKeywordCampaigns(userId, businessId, {
    includeCompleted: true,
    limit: 20,
  });
  await syncActiveCampaignCompletions(
    audit,
    initial.filter((campaign) => campaign.status === "active")
  );

  const campaigns = await listKeywordCampaigns(userId, businessId, {
    includeCompleted: true,
    limit: 20,
  });

  return {
    active: buildCampaignDashboardRows(
      audit,
      campaigns.filter((campaign) => campaign.status === "active")
    ),
    completed: buildCampaignDashboardRows(
      audit,
      campaigns.filter((campaign) => campaign.status === "completed")
    ),
  };
}

export async function refreshCampaignCompletionsForBusiness(
  userId: string,
  businessId: string,
  audit: FullAuditPayload
): Promise<void> {
  const campaigns = await listKeywordCampaigns(userId, businessId, {
    includeCompleted: false,
  });
  await syncActiveCampaignCompletions(audit, campaigns);
}
