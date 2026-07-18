"use client";

import type { PlanPhase, PlanStep, GbpAttributeCoverage, GbpMediaCoverage, GbpPlaceActionCoverage, GbpPlaceActionLinkSummary } from "@/audit/types";
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
  attributeCoverage,
  placeActionCoverage,
  placeActionLinks,
  defaultExpandedStep,
  focusStep,
  focusKeyword,
  variant = "light",
  currency = "USD",
  businessName,
  businessPhone,
  businessWebsite,
  reviewUrl,
  onReviewRequestSent,
  onSeeResults,
}: {
  phase: PlanPhase;
  steps: PlanStep[];
  totalSteps: number;
  gbpConnected: boolean;
  actions: PlanTaskActions;
  attributionByTaskId: Record<string, ActionAttribution>;
  mediaCoverage?: GbpMediaCoverage;
  attributeCoverage?: GbpAttributeCoverage;
  placeActionCoverage?: GbpPlaceActionCoverage;
  placeActionLinks?: GbpPlaceActionLinkSummary[];
  defaultExpandedStep?: number;
  focusStep?: number | null;
  focusKeyword?: string | null;
  currency?: string;
  variant?: "light" | "dark";
  businessName?: string;
  businessPhone?: string;
  businessWebsite?: string;
  reviewUrl?: string | null;
  onReviewRequestSent?: () => void;
  onSeeResults?: (stepNumber: number) => void;
}) {
  const isLight = variant === "light";
  const visibleSteps = steps
    .filter((s) => s.status !== "skipped")
    .sort((a, b) => {
      const aDone = a.status === "completed" ? 1 : 0;
      const bDone = b.status === "completed" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (a.displayOrder ?? a.stepNumber) - (b.displayOrder ?? b.stepNumber);
    });
  const openSteps = visibleSteps.filter((s) => s.status !== "completed");
  const completedSteps = visibleSteps.filter((s) => s.status === "completed");
  const phaseNeedsApproval = openSteps.some((s) => s.status === "needs_approval");
  const focusInCompleted = completedSteps.some(
    (s) => s.stepNumber === focusStep || s.stepNumber === defaultExpandedStep
  );

  if (visibleSteps.length === 0) {
    return null;
  }

  const renderCard = (step: PlanStep, index: number, displayTotal: number) => (
    <PlanStepCard
      key={step.stepNumber}
      step={step}
      totalSteps={totalSteps}
      displayIndex={index + 1}
      displayTotal={displayTotal}
      gbpConnected={gbpConnected}
      actions={actions}
      attributionByTaskId={attributionByTaskId}
      mediaCoverage={mediaCoverage}
      attributeCoverage={attributeCoverage}
      placeActionCoverage={placeActionCoverage}
      placeActionLinks={placeActionLinks}
      defaultExpanded={
        step.stepNumber === defaultExpandedStep || step.stepNumber === focusStep
      }
      variant={variant}
      currency={currency}
      businessName={businessName}
      businessPhone={businessPhone}
      businessWebsite={businessWebsite}
      reviewUrl={reviewUrl}
      initialFocusKeyword={
        step.stepNumber === 10 ? focusKeyword ?? step.context.primaryKeyword ?? null : null
      }
      onReviewRequestSent={onReviewRequestSent}
      onSeeResults={onSeeResults}
    />
  );

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

      {openSteps.length > 0 && (
        <div className="space-y-3">
          {openSteps.map((step, index) => renderCard(step, index, openSteps.length))}
        </div>
      )}

      {completedSteps.length > 0 && (
        <details
          className={`rounded-xl border ${
            isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/10 bg-white/[0.02]"
          }`}
          open={focusInCompleted || openSteps.length === 0}
        >
          <summary
            className={`cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden ${
              isLight ? "text-[#5f6368]" : "text-slate-400"
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span>
                Completed ({completedSteps.length})
                {openSteps.length > 0 ? " — hide finished work" : ""}
              </span>
              <span className="text-xs font-normal">Show / hide</span>
            </span>
          </summary>
          <div className="space-y-2 px-3 pb-3">
            {completedSteps.map((step, index) =>
              renderCard(step, index, completedSteps.length)
            )}
          </div>
        </details>
      )}
    </section>
  );
}
