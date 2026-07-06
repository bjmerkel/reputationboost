"use client";

import type { FullAuditPayload, MonthlyReport, ScoreChangelogEntry } from "@/audit/types";
import type { AttributionSummary } from "@/audit/types/timeseries";
import { aggregateGridCoverage } from "@/audit/geo";
import { formatCurrency } from "@/audit/attribution/roi";
import { formatAvgCoverageLabel } from "@/components/platform/heatmap/coverage-labels";
import ScoreBreakdown from "@/components/audit/ScoreBreakdown";
import ScoreChangelog from "@/components/audit/ScoreChangelog";

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
  loading = false,
  liveScore,
  liveScoreDate,
  dailyChangelog = [],
  estimatedMonthlyRevenue,
  currency = "USD",
}: {
  audit: FullAuditPayload;
  summary: AttributionSummary | null;
  loading?: boolean;
  liveScore?: number | null;
  liveScoreDate?: string | null;
  dailyChangelog?: ScoreChangelogEntry[];
  estimatedMonthlyRevenue?: number | null;
  currency?: string;
}) {
  const scores = audit.strategy?.scores;
  const mom = audit.strategy?.monthOverMonth;
  const report = audit.strategy?.monthlyReport;

  if (loading && !scores) {
    return (
      <section className="rounded-xl border border-[#dadce0] bg-white p-5">
        <p className="text-sm text-[#5f6368]">Loading health summary…</p>
      </section>
    );
  }

  if (!scores) return null;

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
          <p className="text-lg font-semibold text-[#202124]">
            Reputation Boost Score {displayScore}/100
          </p>
          <p className="text-sm text-[#5f6368]">
            Profile {scores.driverScore ?? scores.conversion}/100 · outcome{" "}
            {scores.outcomeIndex ?? Math.round(scores.visibility * 0.6 + scores.revenueCapture * 0.4)}
            /100
          </p>
          <p className="text-sm capitalize text-[#5f6368]">{scores.grade.replace("_", " ")}</p>
          {liveScoreDate && liveScore != null && liveScore !== scores.overall && (
            <p className="mt-1 text-xs text-[#1a73e8]">
              Live score {liveScore}/100 · updated {liveScoreDate}
            </p>
          )}
          {mom && mom.overallScoreChange !== 0 && !liveScoreDate && (
            <p className={`mt-1 text-sm ${mom.overallScoreChange > 0 ? "text-[#137333]" : "text-[#d93025]"}`}>
              {formatDelta(mom.overallScoreChange)} pts since last audit
            </p>
          )}
          {estimatedMonthlyRevenue != null && estimatedMonthlyRevenue > 0 && (
            <p className="mt-2 text-sm font-medium text-[#188038]">
              Est. {formatCurrency(estimatedMonthlyRevenue, currency)}/mo from Maps visibility
            </p>
          )}
          {gridCoverage.keywordsWithGrid > 0 && (
            <p className="mt-1 text-sm text-[#5f6368]">
              <span className="font-medium text-[#202124]">
                {formatAvgCoverageLabel(gridCoverage.avgCoverage)}
              </span>
              {" "}across your service area
              {gridCoverage.avgCoverage < 50 && (
                <span className="text-[#c5221f]"> — expand weak zones on the map</span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[#e8eaed] pt-4">
        <ScoreBreakdown scores={scores} />
      </div>

      {changelog.length > 0 && (
        <div className="mt-4 border-t border-[#e8eaed] pt-4">
          <ScoreChangelog entries={changelog} title="What changed" />
        </div>
      )}

      {report && <EngagementStrip report={report} />}

      {summary && summary.tasksCompleted > 0 && (
        <p className="mt-4 text-sm text-[#3c4043]">
          Last {summary.periodDays} days:{" "}
          <span className="font-medium text-[#188038]">
            +{summary.totalCallsDelta} calls
          </span>
          {summary.totalDirectionsDelta > 0 && (
            <span className="text-[#188038]"> · +{summary.totalDirectionsDelta} directions</span>
          )}
          {summary.totalWebsiteClicksDelta > 0 && (
            <span className="text-[#188038]"> · +{summary.totalWebsiteClicksDelta} clicks</span>
          )}
        </p>
      )}
    </section>
  );
}

function EngagementStrip({ report }: { report: MonthlyReport }) {
  const { calls, directions, websiteClicks } = report.engagement;
  const hasDelta = calls.change !== 0 || directions.change !== 0 || websiteClicks.change !== 0;

  if (!report.hasPriorPeriod && !hasDelta) return null;

  return (
    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#e8eaed] pt-4">
      <Metric label="Calls" value={calls.current} delta={calls.change} />
      <Metric label="Directions" value={directions.current} delta={directions.change} />
      <Metric label="Clicks" value={websiteClicks.current} delta={websiteClicks.change} />
    </div>
  );
}

function Metric({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: number;
}) {
  return (
    <div className="rounded-lg bg-[#f8f9fa] px-3 py-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#80868b]">{label}</p>
      <p className="text-base font-semibold text-[#202124]">{value}</p>
      {delta !== 0 && (
        <p className={`text-xs ${delta > 0 ? "text-[#137333]" : "text-[#d93025]"}`}>
          {formatDelta(delta)} this month
        </p>
      )}
    </div>
  );
}
