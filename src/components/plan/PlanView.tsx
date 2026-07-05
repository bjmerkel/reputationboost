"use client";

import { useEffect, useMemo } from "react";
import type { FullAuditPayload } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { usePlanTasks } from "@/hooks/usePlanTasks";
import PlanPhaseSection from "./PlanPhaseSection";
import PlanProgressHeader from "./PlanProgressHeader";

export default function PlanView({
  audit,
  clientId,
  gbpConnected = true,
  attributionByTaskId = {},
  variant = "light",
  onReviewPending,
}: {
  audit: FullAuditPayload;
  clientId: string;
  gbpConnected?: boolean;
  attributionByTaskId?: Record<string, ActionAttribution>;
  variant?: "light" | "dark";
  onReviewPending?: () => void;
}) {
  const isLight = variant === "light";
  const {
    plan,
    loading,
    error,
    approveAndPublish,
    rejectTask,
    updateDraft,
    publishPhoto,
    uploadPhotoFile,
    uploadVideoFile,
    uploadPhotoBatch,
    savePhotoPreview,
    ensurePhotoTasks,
    approveAllRoutine,
    loadingTaskId,
  } = usePlanTasks({
    clientId,
    auditId: audit.auditId,
    initialTasks: audit.execution?.tasks ?? [],
  });

  const actions = useMemo(
    () => ({
      approveAndPublish,
      rejectTask,
      updateDraft,
      publishPhoto,
      uploadPhotoFile,
      uploadVideoFile,
      uploadPhotoBatch,
      savePhotoPreview,
      ensurePhotoTasks,
      approveAllRoutine,
      loadingTaskId,
      error,
    }),
    [
      approveAndPublish,
      rejectTask,
      updateDraft,
      publishPhoto,
      uploadPhotoFile,
      uploadVideoFile,
      uploadPhotoBatch,
      savePhotoPreview,
      ensurePhotoTasks,
      approveAllRoutine,
      loadingTaskId,
      error,
    ]
  );

  const defaultExpandedStep = useMemo(() => {
    if (!plan) return undefined;
    const needs = plan.steps.find((s) => s.status === "needs_approval");
    return needs?.stepNumber ?? plan.steps.find((s) => s.status === "pending")?.stepNumber;
  }, [plan]);

  useEffect(() => {
    if (!gbpConnected || !plan) return;
    const photoStep = plan.steps.find((s) => s.stepNumber === 6);
    if (photoStep && photoStep.tasks.length === 0) {
      void ensurePhotoTasks().catch(() => undefined);
    }
  }, [gbpConnected, plan, ensurePhotoTasks]);

  if (loading && !plan) {
    return (
      <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>Loading your plan…</p>
    );
  }

  if (!plan) {
    return (
      <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Optimization plan will appear after your audit completes.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {gbpConnected && (
        <div className="rounded-lg border border-[#ceead6] bg-[#e6f4ea] px-4 py-3 text-sm text-[#137333]">
          Approve and publish each step here — changes go directly to your Google Business Profile.
        </div>
      )}

      <PlanProgressHeader plan={plan} variant={variant} onReviewPending={onReviewPending} />

      {audit.strategy?.executiveSummary && (
        <p className={`text-sm leading-relaxed ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
          {audit.strategy.executiveSummary}
        </p>
      )}

      {error && <p className="text-sm text-[#d93025]">{error}</p>}

      {plan.phases.map((phase) => {
        const phaseSteps = plan.steps.filter((s) => s.phaseId === phase.id);
        return (
          <PlanPhaseSection
            key={phase.id}
            phase={phase}
            steps={phaseSteps}
            totalSteps={plan.progress.totalSteps}
            gbpConnected={gbpConnected}
            actions={actions}
            attributionByTaskId={attributionByTaskId}
            mediaCoverage={audit.gbp.content.mediaCoverage}
            defaultExpandedStep={defaultExpandedStep}
            variant={variant}
          />
        );
      })}
    </div>
  );
}
