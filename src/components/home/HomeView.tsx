"use client";

import type { ExecutionTask, FullAuditPayload, ScoreChangelogEntry } from "@/audit/types";
import type { ActionAttribution, AttributionSummary } from "@/audit/types/timeseries";
import { estimateTotalMonthlyRevenue } from "@/audit/phase2/counterfactual";
import ActionAttributionFeed from "@/components/attribution/ActionAttributionFeed";
import ListingStrengthInsights from "@/components/audit/ListingStrengthInsights";
import HomeApprovalCTA from "@/components/home/HomeApprovalCTA";
import HomeHealthSummary from "@/components/home/HomeHealthSummary";
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
}) {
  const batchableCount = pendingBatchTasks(tasks).length;
  const totalPending = tasks.filter((t) => t.status === "pending_approval").length;
  const estimatedMonthlyRevenue = estimateTotalMonthlyRevenue(audit, avgCustomerValue);

  return (
    <div className="space-y-6">
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

      <ListingStrengthInsights
        audit={audit}
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
