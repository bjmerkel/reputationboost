"use client";

import type { PlanPhase, PlanStep, GbpMediaCoverage } from "@/audit/types";
import PlanStepCard from "./PlanStepCard";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";
import type { ActionAttribution } from "@/audit/types/timeseries";

export default function PlanPhaseSection({
  phase,
  steps,
  totalSteps,
  gbpConnected,
  actions,
  attributionByTaskId,
  mediaCoverage,
  defaultExpandedStep,
  variant = "light",
  currency = "USD",
}: {
  phase: PlanPhase;
  steps: PlanStep[];
  totalSteps: number;
  gbpConnected: boolean;
  actions: PlanTaskActions;
  attributionByTaskId: Record<string, ActionAttribution>;
  mediaCoverage?: GbpMediaCoverage;
  defaultExpandedStep?: number;
  currency?: string;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const visibleSteps = steps.filter((s) => s.status !== "completed");
  const phaseNeedsApproval = visibleSteps.some((s) => s.status === "needs_approval");

  if (visibleSteps.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
          {phase.title}
        </h3>
        {phaseNeedsApproval && (
          <span className="rounded-full bg-[#fef7e0] px-2 py-0.5 text-[10px] font-medium text-[#e37400]">
            Action needed
          </span>
        )}
      </div>

      <div className="space-y-3">
        {visibleSteps.map((step) => (
          <PlanStepCard
            key={step.stepNumber}
            step={step}
            totalSteps={totalSteps}
            gbpConnected={gbpConnected}
            actions={actions}
            attributionByTaskId={attributionByTaskId}
            mediaCoverage={mediaCoverage}
            defaultExpanded={step.stepNumber === defaultExpandedStep}
            variant={variant}
            currency={currency}
          />
        ))}
      </div>
    </section>
  );
}
