"use client";

import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import type { ActionAttribution, AttributionSummary } from "@/audit/types/timeseries";
import ActionAttributionFeed from "@/components/attribution/ActionAttributionFeed";
import HomeApprovalCTA from "@/components/home/HomeApprovalCTA";
import HomeHealthSummary from "@/components/home/HomeHealthSummary";
import { pendingBatchTasks } from "@/lib/execution/pending-tasks";

export default function HomeView({
  audit,
  tasks,
  summary,
  attributions,
  attributionLoading = false,
  onReviewPending,
}: {
  audit: FullAuditPayload;
  tasks: ExecutionTask[];
  summary: AttributionSummary | null;
  attributions: ActionAttribution[];
  attributionLoading?: boolean;
  onReviewPending: () => void;
}) {
  const batchableCount = pendingBatchTasks(tasks).length;
  const totalPending = tasks.filter((t) => t.status === "pending_approval").length;

  return (
    <div className="space-y-6">
      <HomeHealthSummary audit={audit} summary={summary} loading={attributionLoading} />

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
