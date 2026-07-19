"use client";

import type { PathToHealthy } from "@/audit/types";
import { formatCurrency } from "@/audit/attribution/roi";
import {
  calibrationConfidenceLabel,
  formatPathStepImpact,
  optimizationModeHint,
} from "./path-impact-display";
import type { AcvCopy } from "@/lib/business/acv-copy";
import { resolveAcvCopy } from "@/lib/business/acv-copy";

export default function PathToHealthyPanel({
  path,
  currency = "USD",
  acvCopy = resolveAcvCopy(),
}: {
  path: PathToHealthy;
  currency?: string;
  acvCopy?: AcvCopy;
}) {
  if (path.alreadyHealthy) {
    return (
      <section className="rounded-xl border border-[#ceead6] bg-[#f6faf7] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#137333]">
          Profile strength
        </p>
        <p className="mt-1 text-sm font-medium text-[#202124]">
          Profile strength is Healthy at {path.currentDriverScore}/100 — maintain your weekly cadence.
        </p>
        <p className="mt-1 text-xs text-[#5f6368]">
          Reputation Boost Score {path.currentScore}/100 · ranking outcome {path.outcomeIndex}/100
        </p>
        {path.estimatedMonthlyRevenue != null && path.estimatedMonthlyRevenue > 0 && (
          <p className="mt-2 text-sm font-medium text-[#188038]">
            Est. {formatCurrency(path.estimatedMonthlyRevenue, currency)}/mo from Maps visibility
          </p>
        )}
      </section>
    );
  }

  const pct = Math.min(
    100,
    path.pointsNeeded > 0
      ? Math.round(
          ((path.projectedDriverScore - path.currentDriverScore) / path.pointsNeeded) * 100
        )
      : 100
  );

  const modeHint = optimizationModeHint(path.optimizationMode);
  const calibrationLabel = calibrationConfidenceLabel(path.calibrationConfidence);
  const hasMonthlyRevenue =
    path.estimatedMonthlyRevenue != null &&
    path.projectedMonthlyRevenue != null &&
    path.estimatedMonthlyRevenue > 0;

  return (
    <section className="rounded-xl border border-[#dadce0] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
        Path to {path.targetScore} profile strength
      </p>

      {hasMonthlyRevenue && (
        <p className="mt-2 text-lg font-semibold text-[#188038]">
          {formatCurrency(path.estimatedMonthlyRevenue!, currency)} →{" "}
          {formatCurrency(path.projectedMonthlyRevenue!, currency)}
          <span className="text-sm font-medium text-[#5f6368]"> /mo est.</span>
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <p className="text-lg font-semibold text-[#202124]">
          {path.currentDriverScore} → {path.projectedDriverScore}
        </p>
        <p className="text-sm text-[#5f6368]">
          need {path.pointsNeeded} driver pts · ~{path.steps.length} action
          {path.steps.length === 1 ? "" : "s"}
        </p>
      </div>

      <p className="mt-1 text-xs text-[#80868b]">
        Reputation Boost Score {path.currentScore} → {path.projectedScore} · ranking outcome{" "}
        {path.outcomeIndex} → {path.projectedOutcomeIndex}
        {path.currentRevenueCapture != null &&
          path.projectedRevenueCapture != null &&
          path.projectedRevenueCapture > path.currentRevenueCapture && (
            <>
              {" "}
              · revenue capture {path.currentRevenueCapture}% → {path.projectedRevenueCapture}%
            </>
          )}
      </p>

      {modeHint && <p className="mt-1 text-xs text-[#80868b]">{modeHint}</p>}
      {calibrationLabel && (
        <p className="mt-1 text-xs text-[#80868b]">{calibrationLabel}</p>
      )}

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8eaed]">
        <div
          className="h-full rounded-full bg-[#007b83] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {path.estimatedRevenueGainLabel && (
        <p className="mt-2 text-sm font-medium text-[#188038]">{path.estimatedRevenueGainLabel}</p>
      )}

      {path.steps.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {path.steps.slice(0, 5).map((step) => (
            <li
              key={`${step.source}-${step.id}`}
              className="flex items-start justify-between gap-2 text-sm text-[#3c4043]"
            >
              <span className="min-w-0">
                {step.source === "gap" && (
                  <span className="mr-1.5 rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#5f6368]">
                    Gap
                  </span>
                )}
                {step.title}
              </span>
              <span className="shrink-0 font-semibold text-[#188038]">
                {formatPathStepImpact(step, path.optimizationMode, currency)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {!hasMonthlyRevenue && path.steps.some((s) => (s.revenueImpact ?? 0) > 0) && (
        <p className="mt-2 text-xs text-[#80868b]">{acvCopy.settingsPrompt}</p>
      )}
    </section>
  );
}
