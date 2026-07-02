import type { MonthlyReport } from "@/audit/types";
import { describeCompetitorDelta, describeRankMovement } from "@/audit/phase2/monthly-report";

const priorityStyles: Record<string, string> = {
  P0: "bg-red-500/20 text-red-300",
  P1: "bg-orange-500/20 text-orange-300",
  P2: "bg-amber-500/20 text-amber-300",
  P3: "bg-slate-500/20 text-slate-300",
};

export default function MonthlyReportPanel({ report }: { report: MonthlyReport }) {
  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-white/[0.02] to-cyan-500/5 p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
          Monthly Report
        </span>
        {report.hasPriorPeriod && report.priorPeriod && (
          <span className="text-xs text-slate-500">vs. {report.priorPeriod}</span>
        )}
        {!report.hasPriorPeriod && (
          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">
            Baseline — run again next month for before/after
          </span>
        )}
        {report.contentSource === "llm" && (
          <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-medium text-violet-300">
            AI-generated
          </span>
        )}
      </div>

      <h3 className="text-xl font-bold leading-snug text-white md:text-2xl">
        {report.headline}
      </h3>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ReportBlock title="Rank movement" icon="📈">
          {report.rankMovements.length === 0 ? (
            <p className="text-sm text-slate-400">No rank changes this period.</p>
          ) : (
            <ul className="space-y-2">
              {report.rankMovements.slice(0, 5).map((m) => (
                <li
                  key={m.keyword}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.improved
                      ? "bg-emerald-500/10 text-emerald-200"
                      : m.fromPosition !== m.toPosition
                        ? "bg-red-500/10 text-red-200"
                        : "bg-white/5 text-slate-300"
                  }`}
                >
                  {describeRankMovement(m)}
                </li>
              ))}
            </ul>
          )}
        </ReportBlock>

        <ReportBlock title="Engagement lift" icon="📞">
          <div className="space-y-3">
            <EngagementRow label="Calls" metric={report.engagement.calls} />
            <EngagementRow label="Directions" metric={report.engagement.directions} />
            <EngagementRow label="Website clicks" metric={report.engagement.websiteClicks} />
          </div>
        </ReportBlock>

        <ReportBlock title="Competitor delta" icon="⚔️">
          {report.competitorDeltas.length === 0 ? (
            <p className="text-sm text-slate-400">
              {report.hasPriorPeriod
                ? "No tracked competitor changes this period."
                : "Competitor tracking starts on your next monthly audit."}
            </p>
          ) : (
            <ul className="space-y-2">
              {report.competitorDeltas.map((d) => (
                <li
                  key={d.competitorName}
                  className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300"
                >
                  {describeCompetitorDelta(d)}
                </li>
              ))}
            </ul>
          )}
        </ReportBlock>

        <ReportBlock title="Next month plan" icon="🎯">
          <p className="mb-3 text-xs text-slate-500">
            Top 5 actions ranked by expected impact
          </p>
          <ol className="space-y-3">
            {report.nextMonthPlan.map((action, i) => (
              <li
                key={action.id}
                className="rounded-lg border border-white/8 bg-white/[0.03] p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${priorityStyles[action.priority]}`}
                      >
                        {action.priority}
                      </span>
                      <span className="text-xs text-slate-500">{action.expectedImpact}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-white">{action.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{action.description}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </ReportBlock>
      </div>
    </section>
  );
}

function ReportBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
        <span>{icon}</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

function EngagementRow({
  label,
  metric,
}: {
  label: string;
  metric: { current: number; prior: number; change: number; changePercent: number | null };
}) {
  const positive = metric.change > 0;
  const negative = metric.change < 0;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-3 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-white">{metric.current}</span>
        {metric.prior > 0 && (
          <span className="ml-2 text-xs text-slate-500">was {metric.prior}</span>
        )}
        {metric.change !== 0 && (
          <span
            className={`ml-2 text-xs font-medium ${
              positive ? "text-emerald-400" : negative ? "text-red-400" : "text-slate-400"
            }`}
          >
            {positive ? "+" : ""}
            {metric.change}
            {metric.changePercent !== null && ` (${positive ? "+" : ""}${metric.changePercent}%)`}
          </span>
        )}
      </div>
    </div>
  );
}
