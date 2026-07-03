"use client";

import Link from "next/link";
import type { AttributionSummary } from "@/audit/types/timeseries";
import { buildRoiHeadline, formatCurrency } from "@/audit/attribution/roi";

export default function RoiSummaryCard({
  summary,
  loading = false,
}: {
  summary: AttributionSummary | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section className="rounded-xl border border-[#dadce0] bg-gradient-to-br from-[#e8f0fe] to-white p-5">
        <p className="text-sm text-[#5f6368]">Loading ROI summary…</p>
      </section>
    );
  }

  if (!summary) return null;

  const engagementTotal =
    summary.totalCallsDelta + summary.totalDirectionsDelta + summary.totalWebsiteClicksDelta;

  if (!summary.hasCustomerValue) {
    return (
      <section className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#1a73e8]">
          Estimated value
        </p>
        <p className="mt-2 text-sm text-[#5f6368]">
          Add your average customer value to see dollar estimates for your actions.
        </p>
        <Link
          href="/platform/settings"
          className="mt-3 inline-block text-sm font-semibold text-[#1a73e8] hover:underline"
        >
          Set customer value in Settings →
        </Link>
      </section>
    );
  }

  if (summary.tasksCompleted === 0) {
    return (
      <section className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#188038]">
          Estimated value
        </p>
        <p className="mt-2 text-sm text-[#5f6368]">
          Complete tasks from your action queue — ROI estimates appear within 14 days of publishing.
        </p>
      </section>
    );
  }

  const headline =
    summary.totalEstimatedRevenue && summary.totalEstimatedRevenue > 0
      ? buildRoiHeadline(summary.totalEstimatedRevenue, summary.period, summary.currency)
      : null;

  return (
    <section className="rounded-xl border border-[#c2e7cb] bg-gradient-to-br from-[#e6f4ea] via-white to-[#e8f0fe] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#188038]">
        Estimated value · last {summary.periodDays} days
      </p>
      {headline ? (
        <h3 className="mt-2 text-xl font-bold leading-snug text-[#202124] md:text-2xl">
          {headline}
        </h3>
      ) : (
        <h3 className="mt-2 text-lg font-semibold text-[#202124]">
          {summary.tasksCompleted} action{summary.tasksCompleted === 1 ? "" : "s"} tracked
          {engagementTotal > 0 && (
            <span className="text-[#188038]"> · +{engagementTotal} customer actions</span>
          )}
        </h3>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.totalEstimatedRevenue != null && summary.totalEstimatedRevenue > 0 && (
          <Stat
            label="Est. revenue"
            value={formatCurrency(summary.totalEstimatedRevenue, summary.currency)}
            positive
          />
        )}
        <Stat label="Calls" value={`+${summary.totalCallsDelta}`} positive={summary.totalCallsDelta > 0} />
        <Stat
          label="Directions"
          value={`+${summary.totalDirectionsDelta}`}
          positive={summary.totalDirectionsDelta > 0}
        />
        <Stat
          label="Clicks"
          value={`+${summary.totalWebsiteClicksDelta}`}
          positive={summary.totalWebsiteClicksDelta > 0}
        />
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

function Stat({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white/80 px-3 py-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#5f6368]">{label}</p>
      <p
        className={`text-base font-semibold ${
          positive ? "text-[#188038]" : "text-[#202124]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
