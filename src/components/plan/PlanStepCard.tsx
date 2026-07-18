"use client";

import { useState } from "react";
import type { PlanStep, GbpAttributeCoverage, GbpMediaCoverage, GbpPlaceActionCoverage, GbpPlaceActionLinkSummary } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";
import { formatCurrency } from "@/audit/attribution/roi";
import PlanStepDiff from "./PlanStepDiff";
import PlanStepPhotos from "./PlanStepPhotos";
import PlanStepVideos from "./PlanStepVideos";
import PlanStepTaskRow from "./PlanStepTaskRow";
import PlanStepAttributes from "./PlanStepAttributes";
import PlanStepHours from "./PlanStepHours";
import PlanStepPlaceActions from "./PlanStepPlaceActions";
import ReviewRequestPanel from "@/components/review-requests/ReviewRequestPanel";
import ReviewDisputePanel from "@/components/review-disputes/ReviewDisputePanel";
import DriverImpactComparison from "@/components/attribution/DriverImpactComparison";

const STATUS_STYLES = {
  completed: "border-[#ceead6] bg-[#f6faf7]",
  needs_approval: "border-[#feefc3] bg-[#fffbf0]",
  approved: "border-[#d2e3fc] bg-[#f8fbff]",
  skipped: "border-[#dadce0] bg-[#f8f9fa]",
  pending: "border-[#dadce0] bg-white",
} as const;

export default function PlanStepCard({
  step,
  totalSteps,
  displayIndex,
  displayTotal,
  gbpConnected,
  actions,
  attributionByTaskId,
  mediaCoverage,
  attributeCoverage,
  placeActionCoverage,
  placeActionLinks,
  defaultExpanded = false,
  variant = "light",
  currency = "USD",
  businessName,
  businessPhone,
  businessWebsite,
  reviewUrl,
  initialFocusKeyword,
  onReviewRequestSent,
  onSeeResults,
}: {
  step: PlanStep;
  totalSteps: number;
  displayIndex?: number;
  displayTotal?: number;
  gbpConnected: boolean;
  actions: PlanTaskActions;
  attributionByTaskId: Record<string, ActionAttribution>;
  mediaCoverage?: GbpMediaCoverage;
  attributeCoverage?: GbpAttributeCoverage;
  placeActionCoverage?: GbpPlaceActionCoverage;
  placeActionLinks?: GbpPlaceActionLinkSummary[];
  defaultExpanded?: boolean;
  variant?: "light" | "dark";
  currency?: string;
  businessName?: string;
  businessPhone?: string;
  businessWebsite?: string;
  reviewUrl?: string | null;
  initialFocusKeyword?: string | null;
  onReviewRequestSent?: () => void;
  onSeeResults?: (stepNumber: number) => void;
}) {
  const isLight = variant === "light";
  const reviewRequestTask = step.tasks.find(
    (t) => t.type === "review_request" && t.status !== "completed"
  );
  const reviewDisputeTasks = step.tasks.filter(
    (t) => t.type === "review_dispute" && t.status !== "completed"
  );
  const showReviewDisputePanel =
    reviewDisputeTasks.length > 0 ||
    step.stepNumber === 9 ||
    /dispute/i.test(step.title);
  const [expanded, setExpanded] = useState(
    defaultExpanded ||
      step.status === "needs_approval" ||
      step.status === "approved" ||
      reviewRequestTask != null ||
      reviewDisputeTasks.length > 0
  );

  const hasPhotoTasks = step.tasks.some((t) => t.type === "gbp_photo");
  const hasVideoTasks = step.tasks.some((t) => t.type === "gbp_video");
  const attributeTasks = step.tasks.filter(
    (t) => t.type === "gbp_attributes" && t.status !== "completed"
  );
  const hoursTasks = step.tasks.filter(
    (t) => t.type === "gbp_hours" && t.status !== "completed"
  );
  const placeActionTask = step.tasks.find(
    (t) =>
      t.type === "gbp_place_action" &&
      t.status !== "completed" &&
      (t.payload.requiresPlaceActionInput === true || Array.isArray(t.payload.placeActionTypes))
  );
  const nonPhotoTasks = step.tasks.filter(
    (t) =>
      t.type !== "gbp_photo" &&
      t.type !== "gbp_video" &&
      t.type !== "review_request" &&
      t.type !== "review_dispute" &&
      t.type !== "gbp_attributes" &&
      t.type !== "gbp_hours" &&
      t.type !== "gbp_place_action" &&
      t.status !== "completed"
  );
  const statusStyle = STATUS_STYLES[step.status] ?? STATUS_STYLES.pending;
  const stepAttribution = step.tasks
    .map((task) => attributionByTaskId[task.id])
    .find((attr) => attr != null);

  return (
    <article
      id={`plan-step-${step.stepNumber}`}
      className={`rounded-xl border ${isLight ? statusStyle : "border-white/8 bg-white/[0.02]"}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            {displayIndex != null && displayTotal != null
              ? `Step ${displayIndex} of ${displayTotal}`
              : `Step ${step.stepNumber} of ${totalSteps}`}
          </p>
          <h4 className={`mt-0.5 text-base font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
            {step.title}
          </h4>
          {step.context.primaryKeyword && (
            <p className={`mt-1 text-sm ${isLight ? "text-[#1a73e8]" : "text-cyan-300"}`}>
              Targets &ldquo;{step.context.primaryKeyword}&rdquo;
            </p>
          )}
          {step.status !== "completed" &&
            step.status !== "skipped" &&
            (step.context.healthScoreImpact ?? 0) > 0 && (
              <p className={`mt-1 text-xs font-semibold ${isLight ? "text-[#188038]" : "text-emerald-400"}`}>
                +{step.context.healthScoreImpact} Reputation Boost Score pts
              </p>
            )}
          {step.status !== "completed" &&
            step.status !== "skipped" &&
            (step.context.revenueImpact ?? 0) > 0 && (
              <p className={`mt-1 text-xs font-semibold ${isLight ? "text-[#188038]" : "text-emerald-400"}`}>
                +{formatCurrency(step.context.revenueImpact!, currency)}/mo est.
              </p>
            )}
          {step.status !== "completed" &&
            step.status !== "skipped" &&
            !(step.context.revenueImpact ?? 0) &&
            (step.context.outcomeScoreImpact ?? 0) > 0 && (
              <p className={`mt-1 text-xs ${isLight ? "text-[#1a73e8]" : "text-cyan-300"}`}>
                +{step.context.outcomeScoreImpact} ranking outcome pts
              </p>
            )}
          {!expanded && (
            <p className={`mt-1 line-clamp-2 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              {step.context.expectedEffect}
            </p>
          )}
          {step.status === "completed" && step.outcome?.narrative && (
            <p className={`mt-2 text-sm font-medium ${isLight ? "text-[#137333]" : "text-emerald-400"}`}>
              {step.outcome.narrative}
            </p>
          )}
          {step.status === "completed" && (
            <DriverImpactComparison
              attribution={stepAttribution}
              variant={variant}
              className="mt-1"
            />
          )}
          {step.status === "completed" && onSeeResults && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSeeResults(step.stepNumber);
              }}
              className={`mt-2 text-xs font-semibold ${
                isLight ? "text-[#1a73e8] hover:underline" : "text-sky-300 hover:underline"
              }`}
            >
              See results →
            </button>
          )}
        </div>
        <span className={`shrink-0 text-lg ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className={`border-t px-4 pb-4 pt-3 ${isLight ? "border-[#e8eaed]" : "border-white/8"}`}>
          {step.context.selectionRationale && (
            <div
              className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
                isLight
                  ? "border-[#e8f0fe] bg-[#f8fbff] text-[#3c4043]"
                  : "border-sky-400/20 bg-sky-400/10 text-slate-200"
              }`}
            >
              <span className={`font-medium ${isLight ? "text-[#1a73e8]" : "text-sky-300"}`}>
                Why this step:{" "}
              </span>
              {step.context.selectionRationale}
            </div>
          )}

          <p className={`text-sm leading-relaxed ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
            <span className={`font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
              Expected effect:{" "}
            </span>
            {step.context.expectedEffect}
          </p>

          {step.status !== "completed" &&
            step.context.projectionConfidence === "default" &&
            ((step.context.revenueImpact ?? 0) > 0 ||
              (step.context.healthScoreImpact ?? 0) > 0) && (
              <p className={`mt-2 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                Impact is a model estimate until we calibrate from your published results.
              </p>
            )}

          {step.context.targetKeywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {step.context.targetKeywords.slice(0, 4).map((kw) => (
                <span
                  key={kw}
                  className={`rounded-full px-2.5 py-0.5 text-xs ${
                    isLight ? "bg-[#e8f0fe] text-[#1a73e8]" : "bg-white/10 text-slate-300"
                  }`}
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          <PlanStepDiff step={step} variant={variant} />

          {step.copyBlocks?.map((block) => (
            <div
              key={block.label}
              className={`mt-4 rounded-lg p-3 ${isLight ? "bg-[#f8f9fa]" : "bg-white/5"}`}
            >
              <p className={`text-xs font-semibold uppercase ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                {block.label}
              </p>
              <p className={`mt-2 whitespace-pre-wrap text-sm ${isLight ? "text-[#3c4043]" : "text-slate-200"}`}>
                {block.content}
              </p>
            </div>
          ))}

          {hasPhotoTasks && (
            <PlanStepPhotos
              tasks={step.tasks}
              gbpConnected={gbpConnected}
              actions={actions}
              mediaCoverage={mediaCoverage}
              variant={variant}
            />
          )}

          {hasVideoTasks && (
            <PlanStepVideos
              tasks={step.tasks}
              gbpConnected={gbpConnected}
              actions={actions}
              variant={variant}
            />
          )}

          {showReviewDisputePanel && (
            <div className={`mt-6 -mx-2 sm:mx-0`}>
              <ReviewDisputePanel
                tasks={reviewDisputeTasks}
                actions={actions}
                projectedStepGain={step.context.healthScoreImpact ?? undefined}
                variant={variant}
                onDisputeUpdated={() => {
                  void actions.refresh?.();
                }}
              />
            </div>
          )}

          {reviewRequestTask && businessName && (
            <div className="mt-4">
              <ReviewRequestPanel
                businessName={businessName}
                reviewUrl={reviewUrl}
                executionTaskId={reviewRequestTask.id}
                planContext={step.context}
                planBullets={step.bullets}
                initialFocusKeyword={initialFocusKeyword}
                variant={variant}
                onSent={() => onReviewRequestSent?.()}
              />
            </div>
          )}

          {attributeTasks.length > 0 && (
            <div className="mt-4 space-y-3">
              {attributeTasks.map((task) => (
                <PlanStepAttributes
                  key={task.id}
                  task={task}
                  gbpConnected={gbpConnected}
                  actions={actions}
                  coverage={attributeCoverage}
                  businessPhone={businessPhone}
                  businessWebsite={businessWebsite}
                  variant={variant}
                />
              ))}
            </div>
          )}

          {hoursTasks.length > 0 && (
            <div className="mt-4 space-y-3">
              {hoursTasks.map((task) => (
                <PlanStepHours
                  key={task.id}
                  task={task}
                  gbpConnected={gbpConnected}
                  actions={actions}
                  variant={variant}
                />
              ))}
            </div>
          )}

          {placeActionTask && (
            <div className="mt-4">
              <PlanStepPlaceActions
                task={placeActionTask}
                gbpConnected={gbpConnected}
                actions={actions}
                coverage={placeActionCoverage}
                configuredLinks={placeActionLinks}
                variant={variant}
              />
            </div>
          )}

          {nonPhotoTasks.length > 0 && (
            <div className={`space-y-3 ${hasPhotoTasks || hasVideoTasks ? "mt-4" : "mt-4"}`}>
              {nonPhotoTasks.map((task) => (
                <PlanStepTaskRow
                  key={task.id}
                  task={task}
                  gbpConnected={gbpConnected}
                  actions={actions}
                  attribution={attributionByTaskId[task.id]}
                  variant={variant}
                />
              ))}
            </div>
          )}

          {step.tasks.length === 0 && (
            <p className={`mt-4 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              Manual step — complete this update in Google Business Profile, then refresh your plan.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
