"use client";

import type { EngagementPeriodSummary } from "@/audit/engagement-period";
import {
  formatEngagementPeriodLabel,
  formatPerformanceIngestLabel,
} from "@/audit/engagement-period";
import type { AttributionSummary } from "@/audit/types/timeseries";

function formatDelta(change: number, suffix = ""): string {
  if (change === 0) return `0${suffix}`;
  return `${change > 0 ? "+" : ""}${change}${suffix}`;
}

export default function EngagementPeriodCard({
  engagement,
  attribution,
  loading = false,
  variant = "embedded",
  showAttribution = true,
  headline,
}: {
  engagement: EngagementPeriodSummary | null;
  attribution?: AttributionSummary | null;
  loading?: boolean;
  variant?: "embedded" | "section";
  showAttribution?: boolean;
  headline?: string | null;
}) {
  if (loading && !engagement) {
    const loadingClass =
      variant === "section"
        ? "rounded-xl border border-[#dadce0] bg-white p-5 shadow-sm"
        : "mt-4 border-t border-[#e8eaed] pt-4";
    return (
      <div className={loadingClass}>
        <p className="text-sm text-[#5f6368]">Loading engagement…</p>
      </div>
    );
  }

  if (!engagement) return null;

  const { calls, directions, websiteClicks } = engagement;
  const hasTotals =
    calls.current > 0 || directions.current > 0 || websiteClicks.current > 0;
  const hasDelta =
    calls.change !== 0 || directions.change !== 0 || websiteClicks.change !== 0;

  if (!hasTotals && !hasDelta && !attribution?.tasksCompleted) return null;

  const ingestLabel = formatPerformanceIngestLabel(engagement);

  const wrapperClass =
    variant === "section"
      ? "rounded-xl border border-[#dadce0] bg-white p-5 shadow-sm"
      : "mt-4 border-t border-[#e8eaed] pt-4";

  return (
    <section className={wrapperClass}>
      {headline && (
        <p className="mb-3 text-base font-semibold leading-snug text-[#202124]">{headline}</p>
      )}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
          Last {engagement.periodDays} days
        </p>
        <p className="text-xs text-[#80868b]">{formatEngagementPeriodLabel(engagement)}</p>
      </div>

      {ingestLabel && engagement.source !== "audit_fallback" && (
        <p className="mt-1 text-xs text-[#80868b]">{ingestLabel}</p>
      )}

      {engagement.source === "audit_fallback" && ingestLabel && (
        <p className="mt-1 text-xs text-[#80868b]">
          {ingestLabel} — nightly ingest will replace these totals.
        </p>
      )}

      {!ingestLabel && engagement.source === "ingest" && (
        <p className="mt-1 text-xs text-[#80868b]">
          Daily performance ingest has not run yet for this profile.
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric
          label="Calls"
          value={calls.current}
          delta={calls.change}
          periodDays={engagement.periodDays}
        />
        <Metric
          label="Directions"
          value={directions.current}
          delta={directions.change}
          periodDays={engagement.periodDays}
        />
        <Metric
          label="Clicks"
          value={websiteClicks.current}
          delta={websiteClicks.change}
          periodDays={engagement.periodDays}
        />
      </div>

      {showAttribution && attribution && attribution.tasksCompleted > 0 && (
        <div className="mt-4 space-y-1 text-sm text-[#3c4043]">
          <p>
            Plan actions ({attribution.periodDays}d):{" "}
            <span className="font-medium text-[#188038]">
              {attribution.tasksCompleted} published
            </span>
            {attribution.keywordsImproved > 0 && (
              <span className="text-[#188038]">
                {" "}
                · {attribution.keywordsImproved} keywords improved
              </span>
            )}
          </p>
          <p>
            From plan actions:{" "}
            <span className="font-medium text-[#188038]">
              {formatDelta(attribution.totalCallsDelta)} calls
            </span>
            {attribution.totalDirectionsDelta > 0 && (
              <span className="text-[#188038]">
                {" "}
                · {formatDelta(attribution.totalDirectionsDelta)} directions
              </span>
            )}
            {attribution.totalWebsiteClicksDelta > 0 && (
              <span className="text-[#188038]">
                {" "}
                · {formatDelta(attribution.totalWebsiteClicksDelta)} clicks
              </span>
            )}
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  delta,
  periodDays,
}: {
  label: string;
  value: number;
  delta: number;
  periodDays: number;
}) {
  return (
    <div className="rounded-lg bg-[#f8f9fa] px-3 py-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#80868b]">{label}</p>
      <p className="text-base font-semibold text-[#202124]">{value}</p>
      {delta !== 0 && (
        <p className={`text-xs ${delta > 0 ? "text-[#137333]" : "text-[#d93025]"}`}>
          {formatDelta(delta)} vs prior {periodDays}d
        </p>
      )}
    </div>
  );
}
