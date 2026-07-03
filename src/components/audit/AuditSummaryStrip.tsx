"use client";

import type { FullAuditPayload } from "@/audit/types";
import { normalizeHealthScores } from "@/components/audit/ScoreBreakdown";

interface AuditSummaryStripProps {
  audit: FullAuditPayload;
}

export default function AuditSummaryStrip({ audit }: AuditSummaryStripProps) {
  const { strategy, rankings, gbp } = audit;
  const scores = normalizeHealthScores(strategy?.scores);
  const score = scores?.overall ?? 0;
  const grade = scores?.grade ?? "at_risk";
  const outcomes = scores?.engagementOutcomes;

  const gradeColor =
    grade === "healthy"
      ? "text-emerald-400"
      : grade === "urgent"
        ? "text-red-400"
        : "text-amber-400";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard label="Reputation Boost Score" value={`${score}/100`} hint={grade.replace("_", " ")} hintClass={gradeColor} />
      <SummaryCard
        label="Visibility"
        value={`${scores?.visibility ?? rankings.shareOfVoice}/100`}
        hint={`${rankings.keywordsInPack}/${rankings.totalKeywords} in 3-Pack`}
      />
      <SummaryCard
        label="Conversion"
        value={`${scores?.conversion ?? "—"}/100`}
        hint="profile trust signals"
      />
      <SummaryCard
        label="Calls (30d)"
        value={String(outcomes?.calls ?? gbp.performance.calls ?? 0)}
        hint={
          outcomes
            ? `${outcomes.directions} directions · ${outcomes.websiteClicks} clicks`
            : gbp.performance.source === "api"
              ? "outcome metrics"
              : "re-run audit for live data"
        }
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  hintClass = "text-slate-500",
}: {
  label: string;
  value: string;
  hint: string;
  hintClass?: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
      <p className={`mt-0.5 text-xs capitalize ${hintClass}`}>{hint}</p>
    </div>
  );
}
