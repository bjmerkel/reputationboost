"use client";

import type { Plan } from "@/audit/types";
import { formatCurrency } from "@/audit/attribution/roi";
import { formatLeadsMo } from "@/audit/phase3/plan-impact-label";
import {
  calibrationConfidenceLabel,
  projectionEstimatePrefix,
  revenueProjectionFormulaHint,
} from "@/components/audit/path-impact-display";
import { formatPlanTimestamp } from "./plan-timestamps";

export default function PlanProgressHeader({
  plan,
  variant = "light",
  onReviewPending,
  pendingApprovalCount,
  estimatedMonthlyRevenue,
  projectedMonthlyRevenue,
  estimatedMonthlyLeads,
  projectedMonthlyLeads,
  pathStepCount,
  nextThreeStepCount,
  nextThreeEstimatedMonthlyRevenue,
  nextThreeProjectedMonthlyRevenue,
  nextThreeEstimatedMonthlyLeads,
  nextThreeProjectedMonthlyLeads,
  currency = "USD",
  planReconciledAt,
  onRefreshPlan,
  refreshingPlan = false,
  calibrationConfidence,
}: {
  plan: Plan;
  variant?: "light" | "dark";
  onReviewPending?: () => void;
  pendingApprovalCount?: number;
  estimatedMonthlyRevenue?: number | null;
  projectedMonthlyRevenue?: number | null;
  estimatedMonthlyLeads?: number | null;
  projectedMonthlyLeads?: number | null;
  pathStepCount?: number;
  nextThreeStepCount?: number;
  nextThreeEstimatedMonthlyRevenue?: number | null;
  nextThreeProjectedMonthlyRevenue?: number | null;
  nextThreeEstimatedMonthlyLeads?: number | null;
  nextThreeProjectedMonthlyLeads?: number | null;
  currency?: string;
  planReconciledAt?: string | null;
  onRefreshPlan?: () => void;
  refreshingPlan?: boolean;
  calibrationConfidence?: "high" | "medium" | "low" | "default";
}) {
  const isLight = variant === "light";
  const { progress } = plan;
  const approvalCount = pendingApprovalCount ?? progress.needsApproval;
  const pct =
    progress.totalSteps > 0
      ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
      : 0;
  const reconciledLabel = formatPlanTimestamp(planReconciledAt);
  const confidenceLabel = calibrationConfidenceLabel(calibrationConfidence);
  const estimatePrefix = projectionEstimatePrefix(calibrationConfidence);
  const mutedText = isLight ? "text-[#5f6368]" : "text-slate-400";
  const subtleText = isLight ? "text-[#80868b]" : "text-slate-500";

  const showRevenue =
    estimatedMonthlyRevenue != null &&
    projectedMonthlyRevenue != null &&
    estimatedMonthlyRevenue > 0;
  const showLeads =
    !showRevenue &&
    estimatedMonthlyLeads != null &&
    projectedMonthlyLeads != null &&
    estimatedMonthlyLeads > 0;
  const showNextThreeRevenue =
    nextThreeEstimatedMonthlyRevenue != null &&
    nextThreeProjectedMonthlyRevenue != null &&
    nextThreeEstimatedMonthlyRevenue > 0 &&
    (nextThreeProjectedMonthlyRevenue !== projectedMonthlyRevenue ||
      (nextThreeStepCount ?? 0) < (pathStepCount ?? 0));
  const showNextThreeLeads =
    !showNextThreeRevenue &&
    nextThreeEstimatedMonthlyLeads != null &&
    nextThreeProjectedMonthlyLeads != null &&
    nextThreeEstimatedMonthlyLeads > 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-slate-900"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${
              isLight ? "text-[#80868b]" : "text-slate-500"
            }`}
          >
            Your optimization plan
          </p>
          {showRevenue && (
            <div className="mt-1">
              <p className={`text-xs ${mutedText}`}>
                Projected after {pathStepCount ?? progress.totalSteps} recommended step
                {(pathStepCount ?? progress.totalSteps) === 1 ? "" : "s"}
              </p>
              <p
                className={`text-base font-semibold ${
                  isLight ? "text-[#188038]" : "text-emerald-400"
                }`}
              >
                {estimatePrefix}{" "}
                {formatCurrency(estimatedMonthlyRevenue!, currency)} →{" "}
                {formatCurrency(projectedMonthlyRevenue!, currency)}/mo
              </p>
            </div>
          )}
          {showLeads && (
            <div className="mt-1">
              <p className={`text-xs ${mutedText}`}>
                Projected after {pathStepCount ?? progress.totalSteps} recommended step
                {(pathStepCount ?? progress.totalSteps) === 1 ? "" : "s"}
              </p>
              <p
                className={`text-base font-semibold ${
                  isLight ? "text-[#188038]" : "text-emerald-400"
                }`}
              >
                {estimatePrefix}{" "}
                {formatLeadsMo(estimatedMonthlyLeads!).replace(" leads/mo", "")} →{" "}
                {formatLeadsMo(projectedMonthlyLeads!)}
              </p>
            </div>
          )}
          {showNextThreeRevenue && (
            <p
              className={`mt-1 text-sm font-medium ${
                isLight ? "text-[#137333]" : "text-emerald-300"
              }`}
            >
              Next {nextThreeStepCount ?? 3} actions: {estimatePrefix}{" "}
              {formatCurrency(nextThreeEstimatedMonthlyRevenue!, currency)} →{" "}
              {formatCurrency(nextThreeProjectedMonthlyRevenue!, currency)}/mo
            </p>
          )}
          {showNextThreeLeads && (
            <p
              className={`mt-1 text-sm font-medium ${
                isLight ? "text-[#137333]" : "text-emerald-300"
              }`}
            >
              Next {nextThreeStepCount ?? 3} actions: {estimatePrefix}{" "}
              {formatLeadsMo(nextThreeEstimatedMonthlyLeads!).replace(" leads/mo", "")} →{" "}
              {formatLeadsMo(nextThreeProjectedMonthlyLeads!)}
            </p>
          )}
          <p
            className={`mt-1 text-sm font-medium ${
              isLight ? "text-[#202124]" : "text-white"
            }`}
          >
            Reputation Boost Score {progress.currentHealthScore} →{" "}
            {progress.projectedHealthScore}
            <span className={isLight ? "text-[#5f6368]" : "text-slate-400"}>
              {" "}
              · {progress.completedSteps} of {progress.totalSteps} steps complete
            </span>
          </p>
          {confidenceLabel ? (
            <p className={`mt-1 text-xs ${subtleText}`}>{confidenceLabel}</p>
          ) : (
            <p className={`mt-1 text-xs ${subtleText}`}>
              Model estimate — not yet calibrated from your published results
            </p>
          )}
          {(showRevenue || showLeads) && (
            <details className="mt-1">
              <summary className={`cursor-pointer text-xs ${subtleText}`}>
                How we calculated this
              </summary>
              <p className={`mt-1 text-xs ${mutedText}`}>{revenueProjectionFormulaHint()}</p>
            </details>
          )}
          {(reconciledLabel || onRefreshPlan) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {reconciledLabel && (
                <p className={`text-xs ${subtleText}`}>
                  Recommendations updated {reconciledLabel}
                </p>
              )}
              {onRefreshPlan && (
                <button
                  type="button"
                  onClick={onRefreshPlan}
                  disabled={refreshingPlan}
                  title="Reconciles tasks with your latest audit data. Does not fetch live Google changes."
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-60 ${
                    isLight
                      ? "border-[#dadce0] text-[#1a73e8] hover:bg-[#e8f0fe]"
                      : "border-white/15 text-sky-300 hover:bg-white/5"
                  }`}
                >
                  {refreshingPlan ? "Refreshing…" : "Refresh plan"}
                </button>
              )}
            </div>
          )}
        </div>
        {approvalCount > 0 &&
          (onReviewPending ? (
            <button
              type="button"
              onClick={onReviewPending}
              className="rounded-full bg-[#fef7e0] px-3 py-1 text-xs font-semibold text-[#e37400] hover:bg-[#feefc3]"
            >
              {approvalCount} need approval → Review
            </button>
          ) : (
            <span className="rounded-full bg-[#fef7e0] px-3 py-1 text-xs font-semibold text-[#e37400]">
              {approvalCount} need{approvalCount === 1 ? "s" : ""} your approval
            </span>
          ))}
      </div>
      <div
        className={`mt-3 h-2 overflow-hidden rounded-full ${
          isLight ? "bg-[#e8eaed]" : "bg-white/10"
        }`}
      >
        <div
          className="h-full rounded-full bg-[#1a73e8] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
