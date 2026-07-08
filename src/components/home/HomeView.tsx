"use client";

import type { ExecutionTask, FullAuditPayload, ScoreChangelogEntry } from "@/audit/types";
import type { ActionAttribution, AttributionSummary } from "@/audit/types/timeseries";
import { estimateTotalMonthlyRevenue } from "@/audit/phase2/counterfactual";
import ActionAttributionFeed from "@/components/attribution/ActionAttributionFeed";
import RoiSummaryCard from "@/components/attribution/RoiSummaryCard";
import ProfilePerformanceTrends from "@/components/audit/ProfilePerformanceTrends";
import ListingStrengthInsights from "@/components/audit/ListingStrengthInsights";
import HomeApprovalCTA from "@/components/home/HomeApprovalCTA";
import HomeHealthSummary from "@/components/home/HomeHealthSummary";
import HomeReviewInbox from "@/components/home/HomeReviewInbox";
import { pendingBatchTasks } from "@/lib/execution/pending-tasks";
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
  onReviewPending: () => void;
  onNavigateToPlan?: (stepNumber: number, scrollTarget?: "google-updates") => void;
  clientId: string;
}) {
  const batchableCount = pendingBatchTasks(tasks).length;
  const totalPending = tasks.filter((t) => t.status === "pending_approval").length;
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
        pendingReplyCount={tasks.filter(
          (t) => t.type === "review_response" && t.status === "pending_approval"
        ).length}
        onReviewPending={onReviewPending}
        onNavigateToPlan={() => onNavigateToPlan?.(11)}
      />

      <RoiSummaryCard summary={summary} loading={attributionLoading} />

      <ProfilePerformanceTrends clientId={clientId} days={30} variant="light" />

      <ListingStrengthInsights
        audit={audit}
        clientId={clientId}
        tasks={tasks}
        attributions={attributions}
        avgCustomerValue={avgCustomerValue}
        currency={avgCustomerValueCurrency}
        globalCalibration={globalCalibration}
        onNavigateToPlan={onNavigateToPlan}
      />

      <ActionAttributionFeed
        attributions={attributions}
        loading={attributionLoading}
        limit={5}
        title="What did we just do?"
      />

      <HomeApprovalCTA pendingCount={totalPending} onReview={onReviewPending} />

      {totalPending > batchableCount && batchableCount > 0 && (
        <p className="text-xs text-[#80868b]">
          {totalPending - batchableCount} photo task
          {totalPending - batchableCount === 1 ? "" : "s"} need generation in Plan before review.
        </p>
      )}
    </div>
  );
}
