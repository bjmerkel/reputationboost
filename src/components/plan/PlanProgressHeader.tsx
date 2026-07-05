"use client";

import type { Plan } from "@/audit/types";
import { formatCurrency } from "@/audit/attribution/roi";

export default function PlanProgressHeader({
  plan,
  variant = "light",
  onReviewPending,
  estimatedMonthlyRevenue,
  projectedMonthlyRevenue,
  currency = "USD",
}: {
  plan: Plan;
  variant?: "light" | "dark";
  onReviewPending?: () => void;
  estimatedMonthlyRevenue?: number | null;
  projectedMonthlyRevenue?: number | null;
  currency?: string;
}) {
  const isLight = variant === "light";
  const { progress } = plan;
  const pct = progress.totalSteps > 0 ? Math.round((progress.completedSteps / progress.totalSteps) * 100) : 0;

  return (
    <div
      className={`sticky top-0 z-10 rounded-xl border p-4 backdrop-blur-sm ${
        isLight ? "border-[#dadce0] bg-white/95" : "border-white/10 bg-slate-900/95"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            Your optimization plan
          </p>
          <p className={`mt-1 text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
            Reputation Boost Score {progress.currentHealthScore} → {progress.projectedHealthScore}
            <span className={isLight ? "text-[#5f6368]" : "text-slate-400"}>
              {" "}
              · {progress.completedSteps} of {progress.totalSteps} steps complete
            </span>
          </p>
          {estimatedMonthlyRevenue != null &&
            projectedMonthlyRevenue != null &&
            estimatedMonthlyRevenue > 0 && (
              <p className={`mt-1 text-sm font-medium ${isLight ? "text-[#188038]" : "text-emerald-400"}`}>
                Est. {formatCurrency(estimatedMonthlyRevenue, currency)} →{" "}
                {formatCurrency(projectedMonthlyRevenue, currency)}/mo
              </p>
            )}
        </div>
        {progress.needsApproval > 0 && (
          onReviewPending ? (
            <button
              type="button"
              onClick={onReviewPending}
              className="rounded-full bg-[#fef7e0] px-3 py-1 text-xs font-semibold text-[#e37400] hover:bg-[#feefc3]"
            >
              {progress.needsApproval} need approval → Review
            </button>
          ) : (
            <span className="rounded-full bg-[#fef7e0] px-3 py-1 text-xs font-semibold text-[#e37400]">
              {progress.needsApproval} need{progress.needsApproval === 1 ? "s" : ""} your approval
            </span>
          )
        )}
      </div>
      <div className={`mt-3 h-2 overflow-hidden rounded-full ${isLight ? "bg-[#e8eaed]" : "bg-white/10"}`}>
        <div
          className="h-full rounded-full bg-[#1a73e8] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
