"use client";

import type { PlanTimelineEntry } from "@/audit/phase3/build-timeline";
import DriverImpactComparison from "@/components/attribution/DriverImpactComparison";
import type { ActionAttribution } from "@/audit/types/timeseries";

function formatRank(rank: number | null | undefined): string {
  if (rank == null) return "—";
  if (rank > 20) return "#20+";
  return `#${rank}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const KIND_STYLES: Record<
  PlanTimelineEntry["kind"],
  { dot: string; label: string; labelClass: string }
> = {
  action: {
    dot: "bg-[#1a73e8]",
    label: "Published",
    labelClass: "bg-[#e8f0fe] text-[#1967d2]",
  },
  rank_shift: {
    dot: "bg-[#188038]",
    label: "Rank change",
    labelClass: "bg-[#e6f4ea] text-[#137333]",
  },
  baseline: {
    dot: "bg-[#80868b]",
    label: "Baseline",
    labelClass: "bg-[#f1f3f4] text-[#5f6368]",
  },
};

export default function PlanResultsTimeline({
  entries,
  attributionsById = {},
  loading = false,
  onNavigateToPlan,
}: {
  entries: PlanTimelineEntry[];
  attributionsById?: Record<string, ActionAttribution>;
  loading?: boolean;
  onNavigateToPlan?: (stepNumber: number) => void;
}) {
  if (loading) {
    return (
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-[#202124]">Plan changelog</h4>
        <p className="text-sm text-[#5f6368]">Loading results…</p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-[#202124]">Plan changelog</h4>
        <p className="text-sm text-[#5f6368]">
          Published plan steps will appear here with measured outcomes.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-[#202124]">Plan changelog</h4>
        <p className="mt-1 text-xs text-[#80868b]">
          What we published and what changed — newest first.
        </p>
      </div>

      <ol className="relative space-y-0 border-l border-[#dadce0] pl-5">
        {entries.map((entry, index) => {
          const style = KIND_STYLES[entry.kind];
          const rankChanged =
            entry.rankBefore != null &&
            entry.rankAfter != null &&
            entry.rankBefore !== entry.rankAfter;

          return (
            <li key={entry.id} className={`relative pb-6 ${index === entries.length - 1 ? "pb-0" : ""}`}>
              <span
                className={`absolute -left-[calc(0.625rem+1px)] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${style.dot}`}
                aria-hidden
              />

              <div className="rounded-lg border border-[#dadce0] bg-white px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.labelClass}`}
                      >
                        {style.label}
                      </span>
                      {entry.stepNumber != null &&
                        (onNavigateToPlan ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToPlan(entry.stepNumber!)}
                            className="text-[10px] font-semibold text-[#1a73e8] hover:underline"
                          >
                            Step {entry.stepNumber} · Open in Plan
                          </button>
                        ) : (
                          <span className="text-[10px] font-medium text-[#80868b]">
                            Step {entry.stepNumber}
                          </span>
                        ))}
                      {entry.preliminary && (
                        <span className="rounded-full bg-[#fef7e0] px-2 py-0.5 text-[10px] font-medium text-[#e37400]">
                          Tracking
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#202124]">{entry.title}</p>
                  </div>
                  <time className="shrink-0 text-xs text-[#80868b]" dateTime={entry.date}>
                    {formatDate(entry.date)}
                  </time>
                </div>

                <p className="mt-2 text-sm text-[#3c4043]">{entry.narrative}</p>

                <DriverImpactComparison
                  attribution={
                    entry.attributionId ? attributionsById[entry.attributionId] : undefined
                  }
                  fields={
                    entry.attributionId && attributionsById[entry.attributionId]
                      ? undefined
                      : {
                          preliminary: entry.preliminary,
                          projectedDriverImpact: entry.projectedDriverImpact,
                          observedDriverImpact: entry.observedDriverImpact,
                          driverScoreBefore: entry.driverScoreBefore,
                          driverScoreAfter: entry.driverScoreAfter,
                        }
                  }
                  className="mt-2"
                />

                {(rankChanged || entry.keyword) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#5f6368]">
                    {entry.keyword && <span>Keyword: {entry.keyword}</span>}
                    {rankChanged && (
                      <span className="text-[#188038]">
                        Rank {formatRank(entry.rankBefore)} → {formatRank(entry.rankAfter)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
