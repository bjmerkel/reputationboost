"use client";

import type { ExecutionTask, FullAuditPayload, ScoreChangelogEntry } from "@/audit/types";
import type { ActionAttribution, AttributionSummary, DailyMetricPoint, ScoreDailySnapshot } from "@/audit/types/timeseries";
import { estimateTotalMonthlyRevenue } from "@/audit/phase2/counterfactual";
import ActionAttributionFeed from "@/components/attribution/ActionAttributionFeed";
import RoiSummaryCard from "@/components/attribution/RoiSummaryCard";
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
  attributions,
  attributionLoading = false,
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
  clientId,
}: {
  audit: FullAuditPayload;
  tasks: ExecutionTask[];
  summary: AttributionSummary | null;
  attributions: ActionAttribution[];
  attributionLoading?: boolean;
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
  clientId: string;
}) {
  const pendingCounts = getPendingApprovalCounts(tasks);
  const approvalCount = planApprovalBadgeCount(tasks);
  const estimatedMonthlyRevenue = estimateTotalMonthlyRevenue(audit, avgCustomerValue);

  return (
    <div className="space-y-6 min-w-0">
      <HomeHealthSummary
        audit={audit}
        summary={summary}
        loading={attributionLoading}
        liveScore={liveScore}
        liveScoreDate={liveScoreDate}
        dailyChangelog={scoreChangelog}
        estimatedMonthlyRevenue={estimatedMonthlyRevenue}
        currency={avgCustomerValueCurrency}
      />

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
