"use client";

import type { ReviewCampaignPlan } from "@/lib/review-requests/campaign-plan";

interface ReviewCampaignPlanCardProps {
  plan: ReviewCampaignPlan;
  eligibleCount: number;
  matchedCustomers: number;
  variant?: "light" | "dark";
  selectedKeyword?: string | null;
  onSelectKeyword?: (keyword: string) => void;
}

export default function ReviewCampaignPlanCard({
  plan,
  eligibleCount,
  matchedCustomers,
  variant = "light",
  selectedKeyword,
  onSelectKeyword,
}: ReviewCampaignPlanCardProps) {
  const isLight = variant === "light";
  const activeKeyword = selectedKeyword ?? plan.focusKeyword;

  return (
    <div
      className={`rounded-xl border p-4 ${
        isLight ? "border-[#d2e3fc] bg-[#f8fbff]" : "border-blue-500/20 bg-blue-500/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              isLight ? "text-[#1a73e8]" : "text-blue-300"
            }`}
          >
            Review campaign plan
          </p>
          <p className={`mt-1 text-sm font-medium ${isLight ? "text-[#202124]" : "text-slate-100"}`}>
            {plan.expectedEffect}
          </p>
        </div>
        {plan.projectedScoreImpact != null && plan.projectedScoreImpact > 0 && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isLight ? "bg-[#ceead6] text-[#137333]" : "bg-emerald-500/20 text-emerald-300"
            }`}
          >
            +{plan.projectedScoreImpact} Reputation Boost pts
          </span>
        )}
      </div>

      <dl className={`mt-4 grid gap-3 text-sm sm:grid-cols-3 ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
        <div>
          <dt className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>Current reviews</dt>
          <dd className="font-semibold">
            {plan.currentReviewCount} at {plan.averageRating}★
          </dd>
        </div>
        <div>
          <dt className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>Monthly target</dt>
          <dd className="font-semibold">{plan.monthlyReviewTarget} new reviews</dd>
        </div>
        <div>
          <dt className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>This batch</dt>
          <dd className="font-semibold">
            {Math.min(plan.batchSize, eligibleCount)} of {eligibleCount} eligible
            {activeKeyword && matchedCustomers > 0 ? ` · ${matchedCustomers} match "${activeKeyword}"` : ""}
          </dd>
        </div>
      </dl>

      {plan.keywordTargets.length > 0 && (
        <div className="mt-4">
          <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            Keyword targets
          </p>
          <ul className="mt-2 space-y-2">
            {plan.keywordTargets.map((target) => {
              const isSelected = activeKeyword === target.keyword;
              return (
                <li key={target.keyword}>
                  <button
                    type="button"
                    onClick={() => onSelectKeyword?.(target.keyword)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? isLight
                          ? "border-[#1a73e8] bg-white shadow-sm"
                          : "border-blue-400/50 bg-white/5"
                        : isLight
                          ? "border-[#dadce0] bg-white/60 hover:border-[#bdc1c6]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium ${isLight ? "text-[#202124]" : "text-slate-100"}`}>
                        {target.keyword}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          target.priority === "high"
                            ? isLight
                              ? "bg-[#fce8e6] text-[#c5221f]"
                              : "bg-red-500/20 text-red-300"
                            : isLight
                              ? "bg-[#feefc3] text-[#b06000]"
                              : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {target.priority}
                      </span>
                      <span className={`text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                        {target.clientReviews} vs {target.packLeaderReviews} leader · need {target.reviewsNeeded}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                      {target.recommendation}
                    </p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className={isLight ? "text-[#80868b]" : "text-slate-500"}>
                          {target.reviewsMentioningKeyword} of {target.reviewsNeeded} keyword-rich
                          reviews
                        </span>
                        <span className={`font-semibold ${isLight ? "text-[#202124]" : "text-slate-200"}`}>
                          {target.progressPercent}%
                        </span>
                      </div>
                      <div
                        className={`mt-1 h-1.5 overflow-hidden rounded-full ${
                          isLight ? "bg-[#e8eaed]" : "bg-white/10"
                        }`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            target.progressPercent >= 100
                              ? "bg-[#188038]"
                              : isLight
                                ? "bg-[#1a73e8]"
                                : "bg-blue-400"
                          }`}
                          style={{ width: `${target.progressPercent}%` }}
                        />
                      </div>
                      {target.reviewsRemaining > 0 && (
                        <p className={`mt-1 text-[10px] ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                          {target.reviewsRemaining} more mentioning &ldquo;{target.keyword}&rdquo; ·{" "}
                          {target.clientReviews} total vs {target.packLeaderReviews} leader
                          {target.campaignStartedAt
                            ? ` · campaign since ${new Date(target.campaignStartedAt).toLocaleDateString()}`
                            : ""}
                          {target.attributedSinceCampaign != null && target.attributedSinceCampaign > 0
                            ? ` · ${target.attributedSinceCampaign} attributed from SMS`
                            : ""}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          How to execute
        </p>
        <ol className={`mt-2 list-decimal space-y-1 pl-5 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
          {plan.executionSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
