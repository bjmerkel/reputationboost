"use client";

import type { Plan } from "@/audit/types";
import { formatCurrency } from "@/audit/attribution/roi";
import { formatLeadsMo } from "@/audit/phase3/plan-impact-label";
import { calibrationConfidenceLabel } from "@/components/audit/path-impact-display";
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
  const isUncalibrated =
    calibrationConfidence == null || calibrationConfidence === "default";

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
          {estimatedMonthlyRevenue != null &&
            projectedMonthlyRevenue != null &&
            estimatedMonthlyRevenue > 0 && (
              <p
                className={`mt-1 text-base font-semibold ${
                  isLight ? "text-[#188038]" : "text-emerald-400"
                }`}
              >
                {isUncalibrated ? "Model est. " : "Est. "}
                {formatCurrency(estimatedMonthlyRevenue, currency)} →{" "}
                {formatCurrency(projectedMonthlyRevenue, currency)}/mo
              </p>
            )}
          {!(estimatedMonthlyRevenue != null && estimatedMonthlyRevenue > 0) &&
            estimatedMonthlyLeads != null &&
            projectedMonthlyLeads != null &&
            estimatedMonthlyLeads > 0 && (
              <p
                className={`mt-1 text-base font-semibold ${
                  isLight ? "text-[#188038]" : "text-emerald-400"
                }`}
              >
                {isUncalibrated ? "Model est. " : "Est. "}
                {formatLeadsMo(estimatedMonthlyLeads).replace(" leads/mo", "")} →{" "}
                {formatLeadsMo(projectedMonthlyLeads)}
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
            <p
              className={`mt-1 text-xs ${
                isLight ? "text-[#80868b]" : "text-slate-500"
              }`}
            >
              {confidenceLabel}
            </p>
          ) : (
            <p
              className={`mt-1 text-xs ${
                isLight ? "text-[#80868b]" : "text-slate-500"
              }`}
            >
              Model estimate — not yet calibrated from your published results
            </p>
          )}
          {(reconciledLabel || onRefreshPlan) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {reconciledLabel && (
                <p
                  className={`text-xs ${
                    isLight ? "text-[#80868b]" : "text-slate-500"
                  }`}
                >
                  Recommendations updated {reconciledLabel}
                </p>
              )}
              {onRefreshPlan && (
                <button
                  type="button"
                  onClick={onRefreshPlan}
                  disabled={refreshingPlan}
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
