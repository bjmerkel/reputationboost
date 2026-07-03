"use client";

import { useState } from "react";
import type { HealthGrade, StrategyReport } from "@/audit/types";
import GbpOptimizationPlanPanel from "@/components/GbpOptimizationPlanPanel";
import { normalizeTextContent } from "@/lib/llm/normalize-content";

const gradeStyles: Record<HealthGrade, string> = {
  healthy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  at_risk: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
};

const priorityStyles: Record<string, string> = {
  P0: "bg-red-500/20 text-red-300",
  P1: "bg-orange-500/20 text-orange-300",
  P2: "bg-amber-500/20 text-amber-300",
  P3: "bg-slate-500/20 text-slate-300",
};

export default function StrategyPanel({
  strategy,
  embedded = false,
  gbpConnected = false,
}: {
  strategy: StrategyReport;
  embedded?: boolean;
  gbpConnected?: boolean;
}) {
  const { scores } = strategy;
  const [showGaps, setShowGaps] = useState(false);

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
        <GbpOptimizationPlanPanel plan={strategy.gbpPlan} gbpConnected={gbpConnected} />
      ) : (
        <p className="text-slate-400">GBP optimization plan will appear after audit completes.</p>
      )}

      <div className="border-t border-white/8 pt-6">
        <button
          type="button"
          onClick={() => setShowGaps(!showGaps)}
          className="text-sm font-medium text-slate-400 hover:text-white"
        >
          {showGaps ? "Hide" : "Show"} quick wins & gap flags ({strategy.actionPlan.length})
        </button>

        {showGaps && (
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="mb-2 font-semibold text-white">30-Day KPI Targets</h4>
              <ul className="space-y-1">
                {strategy.kpiTargets.map((t) => (
                  <li key={t} className="text-sm text-slate-300">
                    → {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              {strategy.actionPlan.slice(0, 6).map((action) => (
                <div
                  key={action.id}
                  className="rounded-lg border border-white/8 bg-white/[0.02] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${priorityStyles[action.priority]}`}
                    >
                      {action.priority}
                    </span>
                    <span className="text-sm font-medium text-white">{action.title}</span>
                  </div>
                  {action.draftCopy && (
                    <p className="mt-2 text-xs italic text-slate-400">
                      {normalizeTextContent(action.draftCopy)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
