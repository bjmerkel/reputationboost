"use client";

import type { AttributionSummary } from "@/audit/types/timeseries";

export default function AttributionsSummaryCard({
  summary,
  loading = false,
}: {
  summary: AttributionSummary | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section className="rounded-xl border border-[#dadce0] bg-gradient-to-br from-[#e8f0fe] to-white p-5">
        <p className="text-sm text-[#5f6368]">Loading action outcomes…</p>
      </section>
    );
  }

  if (!summary || summary.tasksCompleted === 0) {
    return (
      <section className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#1a73e8]">
          Action outcomes
        </p>
        <p className="mt-2 text-sm text-[#5f6368]">
          Complete tasks from your action queue — outcomes appear here within 14 days of publishing.
        </p>
      </section>
    );
  }

  const engagementTotal =
    summary.totalCallsDelta + summary.totalDirectionsDelta + summary.totalWebsiteClicksDelta;

  return (
    <section className="rounded-xl border border-[#c2e7cb] bg-gradient-to-br from-[#e6f4ea] to-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#188038]">
        Action outcomes · last {summary.periodDays} days
      </p>
      <h3 className="mt-2 text-lg font-semibold text-[#202124]">
        {summary.tasksCompleted} action{summary.tasksCompleted === 1 ? "" : "s"} tracked
        {engagementTotal > 0 && (
          <span className="text-[#188038]">
            {" "}
            · +{engagementTotal} customer actions
          </span>
        )}
      </h3>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Calls" value={summary.totalCallsDelta} />
        <Stat label="Directions" value={summary.totalDirectionsDelta} />
        <Stat label="Clicks" value={summary.totalWebsiteClicksDelta} />
      </div>
      {summary.keywordsImproved > 0 && (
        <p className="mt-3 text-sm text-[#137333]">
          {summary.keywordsImproved} keyword{summary.keywordsImproved === 1 ? "" : "s"} improved in
          rank after your actions.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  const negative = value < 0;
  return (
    <div className="rounded-lg bg-white/80 px-3 py-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#5f6368]">{label}</p>
      <p
        className={`text-lg font-semibold ${
          positive ? "text-[#188038]" : negative ? "text-[#d93025]" : "text-[#202124]"
        }`}
      >
        {positive ? "+" : ""}
        {value}
      </p>
    </div>
  );
}
