import type { HealthGrade, StrategyReport } from "@/audit/types";

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

export default function StrategyPanel({ strategy }: { strategy: StrategyReport }) {
  const { scores } = strategy;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
          Phase 2 — Strategy
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${gradeStyles[scores.grade]}`}
        >
          {scores.grade.replace("_", " ")}
        </span>
        <span className="text-2xl font-bold text-white">{scores.overall}/100</span>
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-6">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Executive Summary
        </h4>
        <p className="mt-3 leading-relaxed text-slate-300">{strategy.executiveSummary}</p>
        <p className="mt-3 text-sm text-emerald-400/90">{strategy.localPackStatus}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "GBP", value: scores.gbpCompleteness },
          { label: "3-Pack", value: scores.localPackCoverage },
          { label: "Reviews", value: scores.reviewStrength },
          { label: "Engagement", value: scores.engagement },
          { label: "vs Competitors", value: scores.competitiveGap },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-xl font-bold text-white">{s.value}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                style={{ width: `${s.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {(strategy.biggestWin || strategy.biggestThreat) && (
        <div className="grid gap-4 md:grid-cols-2">
          {strategy.biggestWin && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-400">Biggest Win</p>
              <p className="mt-2 text-sm text-slate-300">{strategy.biggestWin}</p>
            </div>
          )}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-xs font-semibold uppercase text-red-400">Biggest Threat</p>
            <p className="mt-2 text-sm text-slate-300">{strategy.biggestThreat}</p>
          </div>
        </div>
      )}

      {strategy.monthOverMonth && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Month over Month
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <Delta label="3-Pack keywords" value={strategy.monthOverMonth.keywordsInPackChange} />
            <Delta label="Reviews" value={strategy.monthOverMonth.reviewCountChange} />
            <Delta label="Calls" value={strategy.monthOverMonth.callsChange} />
            <Delta label="Score" value={strategy.monthOverMonth.overallScoreChange} />
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-3 font-semibold text-white">30-Day KPI Targets</h4>
        <ul className="space-y-2">
          {strategy.kpiTargets.map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-emerald-400">→</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-3 font-semibold text-white">
          Action Plan ({strategy.actionPlan.length} items)
        </h4>
        <div className="space-y-3">
          {strategy.actionPlan.map((action) => (
            <div
              key={action.id}
              className="rounded-xl border border-white/8 bg-white/[0.02] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${priorityStyles[action.priority]}`}
                >
                  {action.priority}
                </span>
                <span className="text-xs uppercase text-slate-500">{action.category}</span>
                <span className="text-xs text-slate-600">· Due in {action.dueDays}d</span>
              </div>
              <p className="mt-2 font-medium text-white">{action.title}</p>
              <p className="mt-1 text-sm text-slate-400">{action.description}</p>
              {action.draftCopy && (
                <p className="mt-3 rounded-lg bg-white/5 p-3 text-sm italic text-slate-300">
                  {action.draftCopy}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Delta({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  const neutral = value === 0;
  return (
    <span className={neutral ? "text-slate-400" : positive ? "text-emerald-400" : "text-red-400"}>
      {label}: {positive ? "+" : ""}
      {value}
    </span>
  );
}
