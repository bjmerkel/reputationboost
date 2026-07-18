"use client";

import { useMemo } from "react";
import type { FullAuditPayload, Plan } from "@/audit/types";
import { formatCurrency } from "@/audit/attribution/roi";
import { resolveBestPlanStepForKeyword } from "@/audit/phase2/keyword-action-binding";
import { computeKeywordScores } from "@/audit/phase2/keyword-scores";

export default function PlanKeywordPriority({
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
  const priorities = audit.strategy?.gbpPlan?.keywordPriority ?? [];
  const rankings = audit.strategy?.gbpPlan?.keywordRankings ?? [];

  const keywordScores = useMemo(
    () => computeKeywordScores(audit, { avgCustomerValue, currency }),
    [audit, avgCustomerValue, currency]
  );

  const rows = useMemo(() => {
    const source =
      priorities.length > 0
        ? priorities
        : rankings.map((kr, i) => ({
            rank: i + 1,
            keyword: kr.keyword,
            reason: kr.packFragile
              ? `${kr.position} — pack fragile`
              : kr.inLocalPack
                ? `In 3-Pack at ${kr.position}`
                : kr.position,
          }));

    return source.slice(0, 5).map((item) => {
      const ranking = rankings.find(
        (r) => r.keyword.toLowerCase() === item.keyword.toLowerCase()
      );
      const score = keywordScores.find(
        (s) => s.keyword.toLowerCase() === item.keyword.toLowerCase()
      );
      const linkedStepNumber = resolveBestPlanStepForKeyword(audit, plan, item.keyword, {
        avgCustomerValue,
      });
      return {
        ...item,
        inLocalPack: ranking?.inLocalPack ?? score?.inLocalPack ?? false,
        position: ranking?.position ?? score?.positionLabel ?? "—",
        packFragile: ranking?.packFragile ?? false,
        impressions: score?.impressions ?? null,
        revenueGap:
          score?.potentialAtRank1 != null && score?.estimatedMonthlyRevenue != null
            ? Math.max(0, score.potentialAtRank1 - score.estimatedMonthlyRevenue)
            : null,
        linkedStepNumber,
      };
    });
  }, [audit, avgCustomerValue, priorities, rankings, keywordScores, plan]);

  if (rows.length === 0) return null;

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
        Keyword priority
      </p>
      <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Win these searches first for more profile views, calls, and directions.
      </p>
      <ul
        className={`mt-3 divide-y ${isLight ? "divide-[#e8eaed]" : "divide-white/10"}`}
      >
        {rows.map((row) => (
          <li
            key={row.keyword}
            className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-semibold ${
                    isLight ? "text-[#80868b]" : "text-slate-500"
                  }`}
                >
                  #{row.rank}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    isLight ? "text-[#202124]" : "text-white"
                  }`}
                >
                  {row.keyword}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    row.inLocalPack
                      ? isLight
                        ? "bg-[#e6f4ea] text-[#137333]"
                        : "bg-emerald-400/15 text-emerald-300"
                      : isLight
                        ? "bg-[#fce8e6] text-[#c5221f]"
                        : "bg-red-400/15 text-red-300"
                  }`}
                >
                  {row.inLocalPack ? row.position : "Outside 3-Pack"}
                  {row.packFragile ? " · fragile" : ""}
                </span>
              </div>
              <p className={`mt-0.5 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                {row.reason}
                {row.impressions != null && row.impressions > 0
                  ? ` · ${row.impressions.toLocaleString()} impressions/mo`
                  : ""}
              </p>
              {row.revenueGap != null && row.revenueGap > 0 && (
                <p
                  className={`mt-0.5 text-xs font-semibold ${
                    isLight ? "text-[#188038]" : "text-emerald-400"
                  }`}
                >
                  +{formatCurrency(row.revenueGap, currency)}/mo if #1
                </p>
              )}
            </div>
            {row.linkedStepNumber != null && (
              <button
                type="button"
                onClick={() => onFocusKeyword?.(row.keyword, row.linkedStepNumber)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  isLight
                    ? "border-[#dadce0] text-[#1a73e8] hover:bg-[#e8f0fe]"
                    : "border-white/15 text-sky-300 hover:bg-white/5"
                }`}
              >
                Work steps →
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
