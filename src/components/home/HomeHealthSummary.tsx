"use client";

import type { FullAuditPayload, ScoreChangelogEntry } from "@/audit/types";
import type { AttributionSummary } from "@/audit/types/timeseries";
import type { EngagementPeriodSummary } from "@/audit/engagement-period";
import { aggregateGridCoverage } from "@/audit/geo";
import { formatCurrency } from "@/audit/attribution/roi";
import { formatAvgCoverageLabel } from "@/components/platform/heatmap/coverage-labels";
import ScoreBreakdown from "@/components/audit/ScoreBreakdown";
import ScoreChangelog from "@/components/audit/ScoreChangelog";
import EngagementPeriodCard from "@/components/engagement/EngagementPeriodCard";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { formatScoreCalculatedAt } from "@/lib/scores/format-score-date";
import { SCORE_TOOLTIPS } from "@/lib/scores/score-tooltips";

function formatDelta(change: number, suffix = ""): string {
  if (change === 0) return `0${suffix}`;
  return `${change > 0 ? "+" : ""}${change}${suffix}`;
}

function gradeColor(grade: string): string {
  if (grade === "healthy") return "#188038";
  if (grade === "urgent") return "#d93025";
  return "#e37400";
}

export default function HomeHealthSummary({
  audit,
  summary,
  engagement,
  engagementLoading = false,
  loading = false,
  liveScore,
  liveScoreDate,
  dailyChangelog = [],
  estimatedMonthlyRevenue,
  currency = "USD",
  demandAlignmentScore,
}: {
  audit: FullAuditPayload;
  summary: AttributionSummary | null;
  engagement: EngagementPeriodSummary | null;
  engagementLoading?: boolean;
  loading?: boolean;
  liveScore?: number | null;
  liveScoreDate?: string | null;
  dailyChangelog?: ScoreChangelogEntry[];
  estimatedMonthlyRevenue?: number | null;
  currency?: string;
  /** Live portfolio demand alignment; overrides stale audit-time score after keyword edits. */
  demandAlignmentScore?: number;
}) {
  const scores = audit.strategy?.scores;
  const mom = audit.strategy?.monthOverMonth;

  if (loading && !scores) {
    return (
      <section className="rounded-xl border border-[#dadce0] bg-white p-5">
        <p className="text-sm text-[#5f6368]">Loading health summary…</p>
      </section>
    );
  }

  if (!scores) return null;

  const resolvedDemandAlignmentScore =
    demandAlignmentScore ??
    audit.keywordPortfolio?.demandAlignmentScore ??
    scores.demandAlignmentScore;
  const displayScores =
    resolvedDemandAlignmentScore != null &&
    resolvedDemandAlignmentScore !== scores.demandAlignmentScore
      ? { ...scores, demandAlignmentScore: resolvedDemandAlignmentScore }
      : scores;

  const displayScore = Number.isFinite(liveScore) ? liveScore! : Number.isFinite(scores.overall) ? scores.overall : 0;
  const color = gradeColor(scores.grade);
  const auditChangelog = mom?.scoreChangelog ?? [];
  const changelog = dailyChangelog.length > 0 ? dailyChangelog : auditChangelog;
  const gridCoverage = aggregateGridCoverage(audit.rankings.keywords);

  return (
    <section className="rounded-xl border border-[#dadce0] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
        How am I doing?
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 text-lg font-bold"
          style={{ borderColor: color, color }}
        >
          {displayScore}
        </div>
        <div className="min-w-0 flex-1">
          <p className="inline-flex flex-wrap items-center gap-1 text-lg font-semibold text-[#202124]">
            Reputation Boost Score {displayScore}/100
            <InfoTooltip {...SCORE_TOOLTIPS.overall} />
          </p>
          <p className="text-sm text-[#5f6368]">
            <span className="inline-flex items-center gap-1">
              Profile {scores.driverScore ?? scores.conversion}/100
              <InfoTooltip {...SCORE_TOOLTIPS.profileStrength} />
            </span>
            {" · "}
            <span className="inline-flex items-center gap-1">
              outcome{" "}
              {scores.outcomeIndex ??
                Math.round(scores.visibility * 0.6 + scores.revenueCapture * 0.4)}
              /100
              <InfoTooltip {...SCORE_TOOLTIPS.rankingOutcome} />
            </span>
          </p>
          <p className="inline-flex items-center gap-1 text-sm capitalize text-[#5f6368]">
            {scores.grade.replace("_", " ")}
            <InfoTooltip {...SCORE_TOOLTIPS.grade} />
          </p>
          {liveScoreDate && (
            <p className="mt-1 text-xs text-[#80868b]">
              Calculated {formatScoreCalculatedAt(liveScoreDate)}
              {liveScore != null && liveScore !== scores.overall && (
                <span className="text-[#1a73e8]">
                  {" "}
                  · live score {liveScore}/100
                </span>
              )}
            </p>
          )}
          {mom && mom.overallScoreChange !== 0 && (
            <p
              className={`mt-1 inline-flex items-center gap-1 text-sm ${
                mom.overallScoreChange > 0 ? "text-[#137333]" : "text-[#d93025]"
              }`}
            >
              {formatDelta(mom.overallScoreChange)} pts since last audit
              <InfoTooltip {...SCORE_TOOLTIPS.scoreDelta} />
            </p>
          )}
          {estimatedMonthlyRevenue != null && estimatedMonthlyRevenue > 0 && (
            <p className="mt-2 text-sm font-medium text-[#188038]">
              Est. {formatCurrency(estimatedMonthlyRevenue, currency)}/mo from Maps visibility
            </p>
          )}
          {gridCoverage.keywordsWithGrid > 0 && (
            <p className="mt-1 inline-flex flex-wrap items-center gap-1 text-sm text-[#5f6368]">
              <span className="font-medium text-[#202124]">
                {formatAvgCoverageLabel(gridCoverage.avgCoverage)}
              </span>
              <InfoTooltip {...SCORE_TOOLTIPS.serviceAreaCoverage} />
              {" "}across your service area
              {gridCoverage.avgCoverage < 50 && (
                <span className="text-[#c5221f]"> — expand weak zones on the map</span>
              )}
            </p>
          )}
          {resolvedDemandAlignmentScore != null && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-[#5f6368]">
              Keyword demand alignment{" "}
              <span
                className={`font-medium ${
                  resolvedDemandAlignmentScore < 50 ? "text-[#b06000]" : "text-[#137333]"
                }`}
              >
                {resolvedDemandAlignmentScore}%
              </span>
              <InfoTooltip {...SCORE_TOOLTIPS.demandAlignment} />
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[#e8eaed] pt-4">
        <ScoreBreakdown scores={displayScores} />
      </div>

      {changelog.length > 0 && (
        <div className="mt-4 border-t border-[#e8eaed] pt-4">
          <ScoreChangelog entries={changelog} title="What changed" />
        </div>
      )}

      <EngagementPeriodCard
        engagement={engagement}
        attribution={summary}
        loading={engagementLoading || loading}
      />
    </section>
  );
}
