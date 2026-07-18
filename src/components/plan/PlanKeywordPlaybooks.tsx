"use client";

import { useMemo, useState } from "react";
import type { FullAuditPayload, Plan } from "@/audit/types";
import { formatCurrency } from "@/audit/attribution/roi";
import { buildKeywordPlaybooks } from "@/audit/phase2/keyword-action-binding";
import { planScrollElementId } from "@/lib/google/gbp-field-plan-links";

export default function PlanKeywordPlaybooks({
  audit,
  plan,
  avgCustomerValue,
  currency = "USD",
  variant = "light",
  onFocusKeyword,
}: {
  audit: FullAuditPayload;
  plan: Plan;
  avgCustomerValue?: number | null;
  currency?: string;
  variant?: "light" | "dark";
  onFocusKeyword?: (keyword: string, stepNumber?: number) => void;
}) {
  const isLight = variant === "light";
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);

  const playbooks = useMemo(
    () =>
      buildKeywordPlaybooks(audit, plan, {
        avgCustomerValue,
        limit: 3,
      }),
    [audit, plan, avgCustomerValue]
  );

  if (playbooks.length === 0) return null;

  return (
    <section
      className={`rounded-xl border p-4 ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-slate-900"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          isLight ? "text-[#80868b]" : "text-slate-500"
        }`}
      >
        Win these searches
      </p>
      <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        One primary action per keyword — do these to grow views, calls, and directions.
      </p>

      <ol className="mt-3 space-y-3">
        {playbooks.map((playbook) => {
          const supportingOpen = expandedKeyword === playbook.keyword;
          return (
            <li
              key={playbook.keyword}
              className={`rounded-lg border px-3 py-3 ${
                isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        isLight ? "text-[#80868b]" : "text-slate-500"
                      }`}
                    >
                      #{playbook.rank}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        isLight ? "text-[#202124]" : "text-white"
                      }`}
                    >
                      {playbook.keyword}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        playbook.inLocalPack
                          ? isLight
                            ? "bg-[#e6f4ea] text-[#137333]"
                            : "bg-emerald-400/15 text-emerald-300"
                          : isLight
                            ? "bg-[#fce8e6] text-[#c5221f]"
                            : "bg-red-400/15 text-red-300"
                      }`}
                    >
                      {playbook.inLocalPack ? playbook.positionLabel : "Outside 3-Pack"}
                      {playbook.packFragile ? " · fragile" : ""}
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-xs ${
                      isLight ? "text-[#5f6368]" : "text-slate-400"
                    }`}
                  >
                    {playbook.rationale}
                    {playbook.impressions != null && playbook.impressions > 0
                      ? ` · ${playbook.impressions.toLocaleString()} impressions/mo`
                      : ""}
                  </p>
                  {playbook.revenueGap != null && playbook.revenueGap > 0 && (
                    <p
                      className={`mt-0.5 text-xs font-semibold ${
                        isLight ? "text-[#188038]" : "text-emerald-400"
                      }`}
                    >
                      +{formatCurrency(playbook.revenueGap, currency)}/mo if #1
                    </p>
                  )}
                </div>

                {playbook.primaryStep != null && (
                  <button
                    type="button"
                    onClick={() => {
                      onFocusKeyword?.(playbook.keyword, playbook.primaryStep!);
                      const el = document.getElementById(
                        planScrollElementId(playbook.primaryStep!)
                      );
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      isLight
                        ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc]"
                        : "border-sky-400/40 bg-sky-400/15 text-sky-300 hover:bg-sky-400/25"
                    }`}
                  >
                    {playbook.ctaLabel} →
                  </button>
                )}
              </div>

              {playbook.supportingSteps.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedKeyword((current) =>
                        current === playbook.keyword ? null : playbook.keyword
                      )
                    }
                    className={`text-xs font-medium ${
                      isLight ? "text-[#1a73e8]" : "text-sky-300"
                    }`}
                  >
                    {supportingOpen ? "Hide" : "More"} for this keyword
                    {supportingOpen ? "" : ` (${playbook.supportingSteps.length})`}
                  </button>
                  {supportingOpen && (
                    <ul className="mt-1.5 space-y-1">
                      {playbook.supportingSteps.map((step) => (
                        <li key={step.stepNumber}>
                          <button
                            type="button"
                            onClick={() => {
                              onFocusKeyword?.(playbook.keyword, step.stepNumber);
                              const el = document.getElementById(
                                planScrollElementId(step.stepNumber)
                              );
                              el?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                            className={`text-left text-xs ${
                              isLight
                                ? "text-[#5f6368] hover:text-[#1a73e8]"
                                : "text-slate-400 hover:text-sky-300"
                            }`}
                          >
                            Step {step.stepNumber}: {step.title} →
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
