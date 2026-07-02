"use client";

import type { FullAuditPayload } from "@/audit/types";

interface AuditSummaryStripProps {
  audit: FullAuditPayload;
}

export default function AuditSummaryStrip({ audit }: AuditSummaryStripProps) {
  const { strategy, rankings, gbp } = audit;
  const score = strategy?.scores.overall ?? 0;
  const grade = strategy?.scores.grade ?? "at_risk";

  const gradeColor =
    grade === "healthy"
      ? "text-emerald-400"
      : grade === "urgent"
        ? "text-red-400"
        : "text-amber-400";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard label="Health score" value={`${score}/100`} hint={grade.replace("_", " ")} hintClass={gradeColor} />
      <SummaryCard
        label="Local 3-Pack"
        value={`${rankings.keywordsInPack}/${rankings.totalKeywords}`}
        hint="keywords in top 3"
      />
      <SummaryCard label="Share of voice" value={`${rankings.shareOfVoice}%`} hint="pack coverage" />
      <SummaryCard
        label="Engagement (30d)"
        value={String(gbp.performance.calls + gbp.performance.directionRequests)}
        hint="calls + directions"
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
