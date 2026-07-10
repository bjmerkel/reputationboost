"use client";

import { useMemo } from "react";
import type { ExecutionTask, FullAuditPayload, ScoreChangelogEntry } from "@/audit/types";
import type { ActionAttribution, AttributionSummary, DailyMetricPoint, ScoreDailySnapshot } from "@/audit/types/timeseries";
import type { EngagementPeriodSummary } from "@/audit/engagement-period";
import { estimateTotalMonthlyRevenue } from "@/audit/phase2/counterfactual";
import { computeKeywordPortfolio, listUntrackedGbpSearchTerms } from "@/audit/phase2/keyword-portfolio";
import ActionAttributionFeed from "@/components/attribution/ActionAttributionFeed";
import RoiSummaryCard from "@/components/attribution/RoiSummaryCard";
import KeywordPortfolioPanel from "@/components/audit/KeywordPortfolioPanel";
import ListingStrengthInsights from "@/components/audit/ListingStrengthInsights";
import HomeApprovalCTA from "@/components/home/HomeApprovalCTA";
import HomeHealthSummary from "@/components/home/HomeHealthSummary";
import HomeReviewInbox from "@/components/home/HomeReviewInbox";
import { getPendingApprovalCounts, planApprovalBadgeCount } from "@/lib/execution/pending-counts";
import type { AttributionCalibration } from "@/audit/phase2/attribution-calibration";

export default function HomeView({
  audit,
  tasks,
  summary,
  engagement,
  attributions,
  attributionLoading = false,
  engagementLoading = false,
  avgCustomerValue,
  avgCustomerValueCurrency = "USD",
  liveScore,
  liveScoreDate,
  scoreChangelog = [],
  globalCalibration = {},
  performancePoints = [],
  scoreSeries = [],
  trendsLoading = false,
  onReviewPending,
  onNavigateToPlan,
  onKeywordsUpdated,
  clientId,
}: {
  audit: FullAuditPayload;
  tasks: ExecutionTask[];
  summary: AttributionSummary | null;
  engagement: EngagementPeriodSummary | null;
  attributions: ActionAttribution[];
  attributionLoading?: boolean;
  engagementLoading?: boolean;
  avgCustomerValue?: number | null;
  avgCustomerValueCurrency?: string;
  liveScore?: number | null;
  liveScoreDate?: string | null;
  scoreChangelog?: ScoreChangelogEntry[];
  globalCalibration?: AttributionCalibration;
  performancePoints?: DailyMetricPoint[];
  scoreSeries?: ScoreDailySnapshot[];
  trendsLoading?: boolean;
  onReviewPending: () => void;
  onNavigateToPlan?: (stepNumber: number, scrollTarget?: "google-updates") => void;
  onKeywordsUpdated?: (keywords: string[]) => void;
  clientId: string;
}) {
  const pendingCounts = getPendingApprovalCounts(tasks);
  const approvalCount = planApprovalBadgeCount(tasks);
  const estimatedMonthlyRevenue = estimateTotalMonthlyRevenue(audit, avgCustomerValue);
  const keywordPortfolio = useMemo(
    () => audit.keywordPortfolio ?? computeKeywordPortfolio(audit),
    [audit]
  );
  const currentKeywords = useMemo(
    () => audit.rankings.keywords.map((keyword) => keyword.keyword),
    [audit.rankings.keywords]
  );
  const untrackedGbpSearchTerms = useMemo(
    () => listUntrackedGbpSearchTerms(audit),
    [audit]
  );
  const showKeywordPortfolio =
    keywordPortfolio.shouldRotate ||
    keywordPortfolio.untrackedDemandCount > 0 ||
    keywordPortfolio.rankWithoutDemandCount > 0;

  return (
    <div className="space-y-6 min-w-0">
      <HomeHealthSummary
        audit={audit}
        summary={summary}
        engagement={engagement}
        loading={attributionLoading}
        engagementLoading={engagementLoading}
        liveScore={liveScore}
        liveScoreDate={liveScoreDate}
        dailyChangelog={scoreChangelog}
        estimatedMonthlyRevenue={estimatedMonthlyRevenue}
        currency={avgCustomerValueCurrency}
      />

      {showKeywordPortfolio && (
        <KeywordPortfolioPanel
          portfolio={keywordPortfolio}
          currentKeywords={currentKeywords}
          businessSlug={clientId}
          businessName={audit.clientName}
          industry={audit.gbp.identity.primaryCategory}
          city={audit.gbp.identity.address.split(",")[1]?.trim()}
          state={audit.gbp.identity.address.match(/,\s*([A-Z]{2})\s+\d{5}/)?.[1]}
          address={audit.gbp.identity.address}
          website={audit.gbp.identity.website ?? undefined}
          untrackedGbpSearchTerms={untrackedGbpSearchTerms}
          onKeywordsUpdated={onKeywordsUpdated}
        />
      )}

      <HomeReviewInbox
        audit={audit}
        pendingReplyCount={pendingCounts.reviewReplies}
        onReviewPending={onReviewPending}
        onNavigateToPlan={() => onNavigateToPlan?.(11)}
      />

      <RoiSummaryCard summary={summary} loading={attributionLoading} />

      <ListingStrengthInsights
        audit={audit}
        clientId={clientId}
        tasks={tasks}
        attributions={attributions}
        avgCustomerValue={avgCustomerValue}
        currency={avgCustomerValueCurrency}
        globalCalibration={globalCalibration}
        performancePoints={performancePoints}
        scoreSeries={scoreSeries}
        trendsLoading={trendsLoading}
        onNavigateToPlan={onNavigateToPlan}
      />

      <ActionAttributionFeed
        attributions={attributions}
        loading={attributionLoading}
        limit={5}
        title="What did we just do?"
      />

      <HomeApprovalCTA pendingCount={approvalCount} onReview={onReviewPending} />

      {pendingCounts.generating > 0 && pendingCounts.batchable > 0 && (
        <p className="text-xs text-[#80868b]">
          {pendingCounts.generating} photo task
          {pendingCounts.generating === 1 ? "" : "s"} still generating in Plan — review the{" "}
          {pendingCounts.batchable} ready update{pendingCounts.batchable === 1 ? "" : "s"} now.
        </p>
      )}
      {pendingCounts.generating > 0 && pendingCounts.batchable === 0 && (
        <p className="text-xs text-[#80868b]">
          {pendingCounts.generating} photo task
          {pendingCounts.generating === 1 ? "" : "s"} need generation in Plan before review.
        </p>
      )}
    </div>
  );
}
