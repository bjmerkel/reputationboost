"use client";

import type { KeywordScoreCard } from "@/audit/types";
import { formatCurrency } from "@/audit/attribution/roi";

export default function KeywordScoreCards({
  keywords,
  currency = "USD",
  compact = false,
}: {
  keywords: KeywordScoreCard[];
  currency?: string;
  compact?: boolean;
}) {
  if (keywords.length === 0) return null;

  const radiusProfileLabel = keywords[0]?.radiusProfileLabel;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
            Keyword scores
          </p>
          {radiusProfileLabel && (
            <p className="text-[10px] text-[#5f6368]">{radiusProfileLabel}</p>
          )}
        </div>
      )}
      {keywords.map((kw) => (
        <KeywordCard key={kw.keyword} keyword={kw} currency={currency} compact={compact} />
      ))}
    </div>
  );
}

function KeywordCard({
  keyword: kw,
  currency,
  compact,
}: {
  keyword: KeywordScoreCard;
  currency: string;
  compact?: boolean;
}) {
  const packColor = kw.inLocalPack ? "#188038" : "#d93025";

  return (
    <div
      className={`rounded-lg border border-[#e8eaed] bg-[#f8f9fa] ${
        compact ? "p-2.5" : "p-3"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`font-medium text-[#202124] ${compact ? "text-xs" : "text-sm"}`}>
          &ldquo;{kw.keyword}&rdquo;
        </p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${packColor}18`, color: packColor }}
        >
          {kw.positionLabel}
        </span>
      </div>

      {kw.packFragile && (
        <p
          className={`mt-1.5 rounded-md bg-[#fef7e0] px-2 py-1 font-medium text-[#b06000] ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          Pack fragile
          {kw.weakestRadiusMiles != null
            ? ` — drops off by ${kw.weakestRadiusMiles} mi`
            : " — strong at 1 mi only"}
        </p>
      )}

      {kw.radiusRanks.length > 0 && (
        <div className={`mt-2 flex flex-wrap gap-1.5 ${compact ? "text-[10px]" : "text-xs"}`}>
          {kw.radiusRanks.map((radius) => (
            <RadiusBadge key={radius.distanceMiles} radius={radius} compact={compact} />
          ))}
        </div>
      )}

      <div className={`mt-2 grid grid-cols-3 gap-2 ${compact ? "text-[10px]" : "text-xs"}`}>
        <Metric label="Visibility" value={`${kw.visibilityScore}/100`} />
        <Metric label="Relevance" value={`${kw.relevanceScore}/100`} />
        <Metric label="Revenue capture" value={`${kw.revenueCaptureScore}/100`} />
      </div>

      <p className={`mt-1.5 text-[#80868b] ${compact ? "text-[10px]" : "text-xs"}`}>
        {kw.impressionsLabel}
        {kw.gridCoveragePercent != null && (
          <span className="text-[#5f6368]"> · {kw.gridCoveragePercent}% area in pack</span>
        )}
        {kw.scoreImpactIfRank1 > 0 && (
          <span className="text-[#188038]"> · +{kw.scoreImpactIfRank1} pts if #1</span>
        )}
      </p>

      {kw.estimatedMonthlyRevenue != null && kw.potentialAtRank1 != null && (
        <p className={`mt-1 font-medium text-[#3c4043] ${compact ? "text-[10px]" : "text-xs"}`}>
          {formatCurrency(kw.estimatedMonthlyRevenue, currency)}/mo now
          <span className="text-[#80868b]"> → </span>
          {formatCurrency(kw.potentialAtRank1, currency)}/mo at #1
        </p>
      )}

      <p className={`mt-1.5 text-[#5f6368] ${compact ? "text-[10px]" : "text-xs"}`}>
        <span className="font-medium text-[#202124]">Do: </span>
        {kw.suggestedAction}
      </p>
    </div>
  );
}

function RadiusBadge({
  radius,
  compact,
}: {
  radius: KeywordScoreCard["radiusRanks"][number];
  compact?: boolean;
}) {
  const color = radius.inLocalPack ? "#188038" : "#80868b";
  const bg = radius.inLocalPack ? "#e6f4ea" : "#f1f3f4";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
        compact ? "text-[10px]" : "text-xs"
      }`}
      style={{ backgroundColor: bg, color }}
    >
      <span className="text-[#5f6368]">{radius.distanceMiles} mi</span>
      <span>{radius.label}</span>
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[#80868b]">{label}</p>
      <p className="font-semibold text-[#202124]">{value}</p>
    </div>
  );
}
