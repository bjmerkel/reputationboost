"use client";

import type { PlanStep } from "@/audit/types";

function normalizeLabel(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export default function PlanStepDiff({
  step,
  variant = "light",
}: {
  step: PlanStep;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const current = step.context.currentValue ?? step.context.recommendedValue;
  const recommended = step.context.recommendedValue;
  const sameRecommendation =
    Boolean(current) &&
    Boolean(recommended) &&
    normalizeLabel(current) === normalizeLabel(recommended);

  if (!current && !recommended) return null;

  // Avoid a fake "diff" when current and recommended are the same label.
  if (sameRecommendation) {
    return (
      <div className="mt-4">
        <div
          className={`rounded-lg border p-3 ${
            isLight ? "border-[#dadce0] bg-[#f8f9fa]" : "border-white/8 bg-white/5"
          }`}
        >
          <p className={`text-xs font-semibold uppercase ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            Current
          </p>
          <p className={`mt-1 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-200"}`}>{current}</p>
          <p className={`mt-2 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            Already matches the recommended category — no change needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {current && (
        <div
          className={`rounded-lg border p-3 ${
            isLight ? "border-[#dadce0] bg-[#f8f9fa]" : "border-white/8 bg-white/5"
          }`}
        >
          <p className={`text-xs font-semibold uppercase ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            Current
          </p>
          <p className={`mt-1 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-200"}`}>{current}</p>
        </div>
      )}
      {recommended && (
        <div
          className={`rounded-lg border p-3 ${
            isLight ? "border-[#ceead6] bg-[#e6f4ea]" : "border-emerald-500/20 bg-emerald-500/5"
          }`}
        >
          <p className={`text-xs font-semibold uppercase ${isLight ? "text-[#137333]" : "text-emerald-400"}`}>
            Recommended
          </p>
          <p className={`mt-1 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-200"}`}>{recommended}</p>
        </div>
      )}
    </div>
  );
}
