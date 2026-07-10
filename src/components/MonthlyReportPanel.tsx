import type { MonthlyReport } from "@/audit/types";
import { describeCompetitorDelta, describeRankMovement } from "@/audit/phase2/monthly-report";

const priorityStylesDark: Record<string, string> = {
  P0: "bg-red-500/20 text-red-300",
  P1: "bg-orange-500/20 text-orange-300",
  P2: "bg-amber-500/20 text-amber-300",
  P3: "bg-slate-500/20 text-slate-300",
};

const priorityStylesLight: Record<string, string> = {
  P0: "bg-[#fce8e6] text-[#d93025]",
  P1: "bg-[#feefe3] text-[#e37400]",
  P2: "bg-[#fef7e0] text-[#e37400]",
  P3: "bg-[#f1f3f4] text-[#5f6368]",
};

export default function MonthlyReportPanel({
  report,
  auditPeriod,
  embedded = false,
  variant = "dark",
}: {
  report: MonthlyReport;
  /** Current audit period label (e.g. "July 2026") for since-last-audit copy */
  auditPeriod?: string | null;
  embedded?: boolean;
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";

  return (
    <section
      className={
        embedded
          ? "space-y-6"
          : isLight
            ? "rounded-xl border border-[#dadce0] bg-white p-6 shadow-[var(--platform-shadow)] md:p-8"
            : "rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-white/[0.02] to-cyan-500/5 p-6 md:p-8"
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span
          className={`text-sm font-semibold uppercase tracking-widest ${
            isLight ? "text-[#188038]" : "text-emerald-400"
          }`}
        >
          Since last audit
        </span>
        {auditPeriod && (
          <span className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            {auditPeriod}
            {report.hasPriorPeriod && report.priorPeriod ? ` · vs. ${report.priorPeriod}` : ""}
          </span>
        )}
        {!auditPeriod && report.hasPriorPeriod && report.priorPeriod && (
          <span className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            vs. {report.priorPeriod}
          </span>
        )}
        {!report.hasPriorPeriod && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isLight ? "bg-[#fef7e0] text-[#e37400]" : "bg-amber-500/20 text-amber-300"
            }`}
          >
            Baseline — run again next month for before/after
          </span>
        )}
        {report.contentSource === "llm" && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isLight ? "bg-[#f3e8fd] text-[#9334e6]" : "bg-violet-500/20 text-violet-300"
            }`}
          >
            AI-generated
          </span>
        )}
      </div>

      <h3
        className={`text-xl font-bold leading-snug md:text-2xl ${
          isLight ? "text-[#202124]" : "text-white"
        }`}
      >
        {report.headline}
      </h3>

      <div className={`mt-8 grid gap-6${embedded ? "" : " lg:grid-cols-2"}`}>
        <ReportBlock title="Rank movement" icon="📈" variant={variant}>
          {report.rankMovements.length === 0 ? (
            <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              No rank changes since your last audit.
            </p>
          ) : (
            <ul className="space-y-2">
              {report.rankMovements.slice(0, 5).map((m) => (
                <li
                  key={m.keyword}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.improved
                      ? isLight
                        ? "bg-[#e6f4ea] text-[#137333]"
                        : "bg-emerald-500/10 text-emerald-200"
                      : m.fromPosition !== m.toPosition
                        ? isLight
                          ? "bg-[#fce8e6] text-[#c5221f]"
                          : "bg-red-500/10 text-red-200"
                        : isLight
                          ? "bg-[#f8f9fa] text-[#3c4043]"
                          : "bg-white/5 text-slate-300"
                  }`}
                >
                  {describeRankMovement(m)}
                </li>
              ))}
            </ul>
          )}
        </ReportBlock>

        <ReportBlock title="Engagement since last audit" icon="📞" variant={variant}>
          <div className="space-y-3">
            <EngagementRow label="Calls" metric={report.engagement.calls} variant={variant} embedded={embedded} />
            <EngagementRow
              label="Directions"
              metric={report.engagement.directions}
              variant={variant}
              embedded={embedded}
            />
            <EngagementRow
              label="Website clicks"
              metric={report.engagement.websiteClicks}
              variant={variant}
              embedded={embedded}
            />
          </div>
        </ReportBlock>

        <ReportBlock title="Competitor delta" icon="⚔️" variant={variant}>
          {report.competitorDeltas.length === 0 ? (
            <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              {report.hasPriorPeriod
                ? "No tracked competitor changes since your last audit."
                : "Competitor tracking starts on your next audit."}
            </p>
          ) : (
            <ul className="space-y-2">
              {report.competitorDeltas.map((d) => (
                <li
                  key={d.competitorName}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    isLight ? "bg-[#f8f9fa] text-[#3c4043]" : "bg-white/5 text-slate-300"
                  }`}
                >
                  {describeCompetitorDelta(d)}
                </li>
              ))}
            </ul>
          )}
        </ReportBlock>

        <ReportBlock title="Next month plan" icon="🎯" variant={variant}>
          <p className={`mb-3 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            Top 5 actions ranked by expected impact
          </p>
          <ol className="space-y-3">
            {report.nextMonthPlan.map((action, i) => {
              const priorityStyles = isLight ? priorityStylesLight : priorityStylesDark;
              return (
              <li
                key={action.id}
                className={`rounded-lg border p-3 ${
                  isLight ? "border-[#dadce0] bg-[#f8f9fa]" : "border-white/8 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isLight
                        ? "bg-[#e8f0fe] text-[#1a73e8]"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${priorityStyles[action.priority]}`}
                      >
                        {action.priority}
                      </span>
                      <span className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                        {action.expectedImpact}
                      </span>
                    </div>
                    <p className={`mt-1 text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                      {action.title}
                    </p>
                    <p className={`mt-0.5 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                      {action.description}
                    </p>
                  </div>
                </div>
              </li>
            );
            })}
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
  variant = "dark",
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";
  return (
    <div
      className={`rounded-xl border p-5 ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <h4
        className={`mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider ${
          isLight ? "text-[#5f6368]" : "text-slate-400"
        }`}
      >
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
  variant = "dark",
  embedded = false,
}: {
  label: string;
  metric: { current: number; prior: number; change: number; changePercent: number | null };
  variant?: "dark" | "light";
  embedded?: boolean;
}) {
  const isLight = variant === "light";
  const positive = metric.change > 0;
  const negative = metric.change < 0;

  return (
    <div
      className={`rounded-lg px-3 py-2 ${
        embedded ? "space-y-1" : "flex items-center justify-between gap-4"
      } ${isLight ? "bg-[#f8f9fa]" : "bg-white/5"}`}
    >
      <span className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>{label}</span>
      <div
        className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${
          embedded ? "" : "justify-end text-right"
        }`}
      >
        <span className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
          {metric.current}
        </span>
        {metric.prior > 0 && (
          <span className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            was {metric.prior}
          </span>
        )}
        {metric.change !== 0 && (
          <span
            className={`text-xs font-medium ${
              positive
                ? isLight
                  ? "text-[#188038]"
                  : "text-emerald-400"
                : negative
                  ? isLight
                    ? "text-[#d93025]"
                    : "text-red-400"
                  : isLight
                    ? "text-[#5f6368]"
                    : "text-slate-400"
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
