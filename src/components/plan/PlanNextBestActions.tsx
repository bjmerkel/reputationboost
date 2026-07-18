"use client";

import type { Plan } from "@/audit/types";
import { formatPlanStepImpactLabel } from "@/audit/phase3/plan-impact-label";
import { selectNextBestPlanSteps } from "@/audit/phase3/plan-next-actions";
import type { AttributionCalibration } from "@/audit/phase2/attribution-calibration";
import { planScrollElementId } from "@/lib/google/gbp-field-plan-links";

export default function PlanNextBestActions({
  plan,
  currency = "USD",
  variant = "light",
  preferConversionSteps = false,
  calibration,
  onFocusStep,
}: {
  plan: Plan;
  currency?: string;
  variant?: "light" | "dark";
  /** When the listing is visible but under-converting, lead with CTA / place-action work. */
  preferConversionSteps?: boolean;
  calibration?: AttributionCalibration;
  onFocusStep?: (stepNumber: number) => void;
}) {
  const isLight = variant === "light";
  const nextSteps = selectNextBestPlanSteps(plan, 3, {
    preferConversionSteps,
    calibration,
  });
  if (nextSteps.length === 0) return null;

  return (
    <section
      className={`rounded-xl border p-4 ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-slate-900"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          isLight ? "text-[#80868b]" : "text-slate-500"
        }`}
      >
        Next best actions
      </p>
      <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        {preferConversionSteps
          ? "You’re visible — convert views into calls and directions first."
          : "Ordered by expected value, confidence, and effort — do these first."}
      </p>
      <ol className="mt-3 space-y-2">
        {nextSteps.map((step, index) => {
          const impact = formatPlanStepImpactLabel(step, currency);
          return (
            <li key={step.stepNumber}>
              <button
                type="button"
                onClick={() => {
                  onFocusStep?.(step.stepNumber);
                  const el = document.getElementById(planScrollElementId(step.stepNumber));
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                  isLight
                    ? "border-[#e8eaed] hover:border-[#1a73e8] hover:bg-[#e8f0fe]"
                    : "border-white/10 hover:border-sky-400/40 hover:bg-white/5"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isLight ? "bg-[#e8f0fe] text-[#1a73e8]" : "bg-sky-400/15 text-sky-300"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-semibold ${
                      isLight ? "text-[#202124]" : "text-white"
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.context.primaryKeyword && (
                    <span
                      className={`mt-0.5 block text-xs ${
                        isLight ? "text-[#1a73e8]" : "text-cyan-300"
                      }`}
                    >
                      “{step.context.primaryKeyword}”
                    </span>
                  )}
                  <span
                    className={`mt-0.5 block text-xs ${
                      isLight ? "text-[#5f6368]" : "text-slate-400"
                    }`}
                  >
                    {step.context.expectedEffect}
                  </span>
                  {impact && (
                    <span
                      className={`mt-1 block text-xs font-semibold ${
                        isLight ? "text-[#188038]" : "text-emerald-400"
                      }`}
                    >
                      {impact}
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 self-center text-xs font-medium ${
                    step.status === "needs_approval"
                      ? isLight
                        ? "text-[#e37400]"
                        : "text-amber-300"
                      : isLight
                        ? "text-[#1a73e8]"
                        : "text-sky-300"
                  }`}
                >
                  {step.status === "needs_approval" ? "Approve" : "Open"} →
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
