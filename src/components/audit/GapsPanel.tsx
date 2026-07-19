"use client";

import type { FullAuditPayload } from "@/audit/types";
import { formatCurrency } from "@/audit/attribution/roi";
import {
  gapDriverScoreImpact,
  gapOutcomeScoreImpact,
  gapRevenueImpact,
} from "@/audit/phase2/score-impact";
import { resolveAcvCopyFromAudit } from "@/lib/business/acv-copy";

const PRIORITY_STYLES: Record<string, string> = {
  P0: "bg-[#fce8e6] text-[#d93025]",
  P1: "bg-[#feefe3] text-[#e37400]",
  P2: "bg-[#fef7e0] text-[#e37400]",
  P3: "bg-[#f1f3f4] text-[#5f6368]",
};

function gapKeyword(gapId: string): string | null {
  if (!gapId.startsWith("rank-outside-pack-")) return null;
  return gapId.replace("rank-outside-pack-", "");
}

export default function GapsPanel({
  audit,
  avgCustomerValue,
  currency = "USD",
  limit = 8,
}: {
  audit: FullAuditPayload;
  avgCustomerValue?: number | null;
  currency?: string;
  limit?: number;
}) {
  const acvCopy = resolveAcvCopyFromAudit(audit);
  const gaps = (audit.strategy?.gaps ?? [])
    .map((gap) => {
      const driver = gapDriverScoreImpact(gap, audit);
      const outcome = gapOutcomeScoreImpact(gap, audit);
      const revenue = gapRevenueImpact(gap, audit, avgCustomerValue) ?? 0;
      return { gap, driver, outcome, revenue };
    })
    .filter(({ driver, outcome, revenue }) => driver > 0 || outcome > 0 || revenue > 0)
    .sort((a, b) => {
      const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const priDiff =
        (priorityOrder[a.gap.priority] ?? 9) - (priorityOrder[b.gap.priority] ?? 9);
      if (priDiff !== 0) return priDiff;
      return b.revenue - a.revenue || b.outcome - a.outcome || b.driver - a.driver;
    })
    .slice(0, limit);

  if (gaps.length === 0) return null;

  return (
    <section className="rounded-xl border border-[#dadce0] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
        Priority gaps
      </p>
      <p className="mt-1 text-xs text-[#5f6368]">
        Highest-impact issues holding back rankings and revenue capture.
      </p>

      <ul className="mt-3 space-y-2">
        {gaps.map(({ gap, driver, outcome, revenue }) => {
          const keyword = gapKeyword(gap.id);
          const impactLabel =
            revenue > 0
              ? `+${formatCurrency(revenue, currency)}/mo est.`
              : outcome > 0
                ? `+${outcome} outcome`
                : driver > 0
                  ? `+${driver} pts`
                  : null;

          return (
            <li
              key={gap.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-[#e8eaed] px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      PRIORITY_STYLES[gap.priority] ?? PRIORITY_STYLES.P3
                    }`}
                  >
                    {gap.priority}
                  </span>
                  {keyword && (
                    <span className="text-xs text-[#1a73e8]">&ldquo;{keyword}&rdquo;</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[#202124]">{gap.title}</p>
              </div>
              {impactLabel && (
                <span className="shrink-0 text-sm font-semibold text-[#188038]">
                  {impactLabel}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {!avgCustomerValue && gaps.some(({ revenue }) => revenue === 0) && (
        <p className="mt-3 text-xs text-[#80868b]">
          {acvCopy.settingsPrompt}
        </p>
      )}
    </section>
  );
}
