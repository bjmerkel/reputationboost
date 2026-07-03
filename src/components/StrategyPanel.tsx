"use client";

import type { HealthGrade, StrategyReport } from "@/audit/types";
import GbpOptimizationPlanPanel from "@/components/GbpOptimizationPlanPanel";

const gradeStyles: Record<HealthGrade, string> = {
  healthy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  at_risk: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function StrategyPanel({
  strategy,
  embedded = false,
  gbpConnected = false,
  onOpenPhotos,
}: {
  strategy: StrategyReport;
  embedded?: boolean;
  gbpConnected?: boolean;
  onOpenPhotos?: () => void;
}) {
  const { scores } = strategy;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        {!embedded && (
          <span className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
            Phase 2 — Strategy
          </span>
        )}
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${gradeStyles[scores.grade]}`}
        >
          {scores.grade.replace("_", " ")}
        </span>
        <span className="text-2xl font-bold text-white">{scores.overall}/100</span>
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
        <p className="leading-relaxed text-slate-300">{strategy.executiveSummary}</p>
        <p className="mt-2 text-sm text-emerald-400/90">{strategy.localPackStatus}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "GBP", value: scores.gbpCompleteness },
          { label: "3-Pack", value: scores.localPackCoverage },
          { label: "Reviews", value: scores.reviewStrength },
          { label: "Engagement", value: scores.engagement },
          { label: "vs Competitors", value: scores.competitiveGap },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-lg font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {strategy.gbpPlan ? (
        <GbpOptimizationPlanPanel
          plan={strategy.gbpPlan}
          kpiTargets={strategy.kpiTargets}
          gbpConnected={gbpConnected}
          onOpenPhotos={onOpenPhotos}
        />
      ) : (
        <p className="text-slate-400">GBP optimization plan will appear after audit completes.</p>
      )}
    </div>
  );
}
