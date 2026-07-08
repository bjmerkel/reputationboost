"use client";

import { useMemo } from "react";
import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import type { ActionAttribution, AttributionSummary } from "@/audit/types/timeseries";
import { buildPlan } from "@/audit/phase3/build-plan";
import { buildPlanTimeline } from "@/audit/phase3/build-timeline";
import ProfilePerformanceTrends from "@/components/audit/ProfilePerformanceTrends";
import RoiSummaryCard from "@/components/attribution/RoiSummaryCard";
import PlanResultsTimeline from "./PlanResultsTimeline";

export default function ResultsView({
  audit,
  clientId,
  tasks,
  attributions,
  summary,
  attributionLoading = false,
}: {
  audit: FullAuditPayload;
  clientId: string;
  tasks: ExecutionTask[];
  attributions: ActionAttribution[];
  summary: AttributionSummary | null;
  attributionLoading?: boolean;
}) {
  const timelineEntries = useMemo(() => {
    const plan = buildPlan(audit, tasks, attributions);
    return buildPlanTimeline(audit, plan, attributions);
  }, [audit, tasks, attributions]);

  const attributionsById = useMemo(
    () => Object.fromEntries(attributions.map((attr) => [attr.id, attr])),
    [attributions]
  );

  const report = audit.strategy?.monthlyReport;

  return (
    <div className="space-y-6">
      {report && <ResultsMonthlySummary report={report} summary={summary} />}

      <RoiSummaryCard summary={summary} loading={attributionLoading} />

      <ProfilePerformanceTrends clientId={clientId} days={30} variant="light" />

      <PlanResultsTimeline
        entries={timelineEntries}
        attributionsById={attributionsById}
        loading={attributionLoading}
      />
    </div>
  );
}

function ResultsMonthlySummary({
  report,
  summary,
}: {
  report: NonNullable<FullAuditPayload["strategy"]>["monthlyReport"];
  summary: AttributionSummary | null;
}) {
  if (!report) return null;

  const { calls, directions, websiteClicks } = report.engagement;

  return (
    <section className="rounded-xl border border-[#dadce0] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
          This period
        </p>
        {!report.hasPriorPeriod && (
          <span className="rounded-full bg-[#fef7e0] px-2 py-0.5 text-[10px] font-medium text-[#e37400]">
            Baseline
          </span>
        )}
      </div>

      <p className="mt-2 text-base font-semibold leading-snug text-[#202124]">{report.headline}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Calls" value={calls.current} delta={calls.change} />
        <Metric label="Directions" value={directions.current} delta={directions.change} />
        <Metric label="Clicks" value={websiteClicks.current} delta={websiteClicks.change} />
      </div>

      {summary && summary.tasksCompleted > 0 && (
        <p className="mt-4 text-sm text-[#3c4043]">
          Plan actions ({summary.periodDays}d):{" "}
          <span className="font-medium text-[#188038]">{summary.tasksCompleted} published</span>
          {summary.keywordsImproved > 0 && (
            <span className="text-[#188038]"> · {summary.keywordsImproved} keywords improved</span>
          )}
        </p>
      )}
    </section>
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
          {delta > 0 ? "+" : ""}
          {delta} this month
        </p>
      )}
    </div>
  );
}
