"use client";

import { useState } from "react";
import type { KeywordPortfolioAnalysis, KeywordPortfolioStatus } from "@/audit/types";

const STATUS_LABELS: Record<KeywordPortfolioStatus, string> = {
  proven_demand: "Proven demand",
  brand_anchor: "Brand anchor",
  rank_without_demand: "Rank without demand",
  growth_target: "Growth target",
  low_priority: "Low priority",
};

const STATUS_STYLES: Record<KeywordPortfolioStatus, string> = {
  proven_demand: "bg-[#e6f4ea] text-[#137333]",
  brand_anchor: "bg-[#e8f0fe] text-[#1a73e8]",
  rank_without_demand: "bg-[#fef7e0] text-[#b06000]",
  growth_target: "bg-[#fce8e6] text-[#c5221f]",
  low_priority: "bg-[#f1f3f4] text-[#5f6368]",
};

export default function KeywordPortfolioPanel({
  portfolio,
  currentKeywords,
  businessSlug,
  light = true,
  onKeywordsUpdated,
}: {
  portfolio: KeywordPortfolioAnalysis;
  currentKeywords: string[];
  businessSlug?: string;
  light?: boolean;
  onKeywordsUpdated?: (keywords: string[]) => void;
}) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const keywordsChanged =
    portfolio.recommendedKeywords.length > 0 &&
    portfolio.recommendedKeywords.join("|") !== currentKeywords.join("|");

  async function applyRecommendations() {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/business/keywords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: businessSlug,
          applyRecommendations: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        business?: { keywords: string[] };
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to update keywords");
      setApplied(true);
      onKeywordsUpdated?.(data.business?.keywords ?? portfolio.recommendedKeywords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update keywords");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        light ? "border-[#dadce0] bg-white" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`text-sm font-semibold ${light ? "text-[#202124]" : "text-white"}`}>
            Keyword portfolio intelligence
          </h3>
          <p className={`mt-1 text-sm ${light ? "text-[#5f6368]" : "text-slate-400"}`}>
            {portfolio.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetricPill
            light={light}
            label="Demand alignment"
            value={`${portfolio.demandAlignmentScore}%`}
            warn={portfolio.demandAlignmentScore < 50}
          />
          <MetricPill
            light={light}
            label="Rank-only"
            value={String(portfolio.rankWithoutDemandCount)}
            warn={portfolio.rankWithoutDemandCount > 0}
          />
          <MetricPill
            light={light}
            label="Untracked GBP"
            value={String(portfolio.untrackedDemandCount)}
            warn={portfolio.untrackedDemandCount > 0}
          />
        </div>
      </div>

      {portfolio.recommendedSwaps.length > 0 && (
        <div className="mt-4">
          <p className={`text-xs font-semibold uppercase tracking-wider ${light ? "text-[#80868b]" : "text-slate-500"}`}>
            Recommended swaps
          </p>
          <ul className="mt-2 space-y-2">
            {portfolio.recommendedSwaps.map((swap) => (
              <li
                key={`${swap.swapOut}-${swap.swapIn}`}
                className={`rounded-lg px-3 py-2 text-sm ${
                  light ? "bg-[#f8f9fa] text-[#3c4043]" : "bg-white/5 text-slate-300"
                }`}
              >
                <span className="font-medium text-[#c5221f]">{swap.swapOut}</span>
                <span className="mx-2">→</span>
                <span className="font-medium text-[#137333]">{swap.swapIn}</span>
                {swap.estimatedImpressionGain != null && swap.estimatedImpressionGain > 0 && (
                  <span className={`ml-2 text-xs ${light ? "text-[#80868b]" : "text-slate-500"}`}>
                    +{swap.estimatedImpressionGain} impressions/mo
                  </span>
                )}
                <p className={`mt-1 text-xs ${light ? "text-[#5f6368]" : "text-slate-400"}`}>
                  {swap.reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${light ? "text-[#80868b]" : "text-slate-500"}`}>
            Tracked keywords
          </p>
          <ul className="mt-2 space-y-1.5">
            {portfolio.tracked.map((item) => (
              <li
                key={item.keyword}
                className={`flex flex-wrap items-center gap-2 text-sm ${
                  light ? "text-[#202124]" : "text-slate-200"
                }`}
              >
                <span>{item.keyword}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status]}`}
                >
                  {STATUS_LABELS[item.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {portfolio.untrackedCandidates.length > 0 && (
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${light ? "text-[#80868b]" : "text-slate-500"}`}>
              Untracked GBP opportunities
            </p>
            <ul className="mt-2 space-y-1.5">
              {portfolio.untrackedCandidates.slice(0, 6).map((candidate) => (
                <li
                  key={candidate.keyword}
                  className={`text-sm ${light ? "text-[#202124]" : "text-slate-200"}`}
                >
                  <span className="font-medium">{candidate.keyword}</span>
                  <span className={`ml-2 text-xs ${light ? "text-[#80868b]" : "text-slate-500"}`}>
                    {candidate.impressions != null && candidate.impressions > 0
                      ? `${candidate.impressions} impressions`
                      : candidate.belowThreshold
                        ? "< threshold"
                        : "from GBP"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {keywordsChanged && (
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3 ${
            light ? "border-[#dadce0] bg-[#f8f9fa]" : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <div>
            <p className={`text-sm font-medium ${light ? "text-[#202124]" : "text-white"}`}>
              Optimized portfolio ready
            </p>
            <p className={`text-xs ${light ? "text-[#5f6368]" : "text-slate-400"}`}>
              {portfolio.recommendedKeywords.join(" · ")}
            </p>
          </div>
          <button
            type="button"
            disabled={applying || applied}
            onClick={() => void applyRecommendations()}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              applied
                ? "bg-[#e6f4ea] text-[#137333]"
                : "bg-[#1a73e8] text-white hover:bg-[#1557b0] disabled:opacity-60"
            }`}
          >
            {applied ? "Keywords updated" : applying ? "Applying…" : "Apply recommendations"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-[#c5221f]">{error}</p>}
    </div>
  );
}

function MetricPill({
  label,
  value,
  warn,
  light,
}: {
  label: string;
  value: string;
  warn?: boolean;
  light: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-center ${
        warn
          ? light
            ? "bg-[#fef7e0]"
            : "bg-amber-500/10"
          : light
            ? "bg-[#f8f9fa]"
            : "bg-white/5"
      }`}
    >
      <p className={`text-[10px] uppercase tracking-wide ${light ? "text-[#80868b]" : "text-slate-500"}`}>
        {label}
      </p>
      <p
        className={`text-sm font-semibold ${
          warn ? (light ? "text-[#b06000]" : "text-amber-300") : light ? "text-[#202124]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
