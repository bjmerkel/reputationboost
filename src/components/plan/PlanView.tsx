"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FullAuditPayload } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { buildPathToHealthy } from "@/audit/phase2/path-to-healthy";
import { needsGoogleUpdateRefresh } from "@/lib/google/gbp-update-helpers";
import { planScrollElementId } from "@/lib/google/gbp-field-plan-links";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { usePlanTasks } from "@/hooks/usePlanTasks";
import GoogleUpdatesPanel from "./GoogleUpdatesPanel";
import PlanPhaseSection from "./PlanPhaseSection";
import PlanProgressHeader from "./PlanProgressHeader";

export default function PlanView({
  audit,
  clientId,
  gbpConnected = true,
  gbpGoogleUpdateAt,
  attributionByTaskId = {},
  variant = "light",
  onReviewPending,
  onAuditUpdated,
  avgCustomerValue,
  currency = "USD",
  focusStep = null,
  focusScrollTarget = null,
  onFocusHandled,
}: {
  audit: FullAuditPayload;
  clientId: string;
  gbpConnected?: boolean;
  gbpGoogleUpdateAt?: string | null;
  attributionByTaskId?: Record<string, ActionAttribution>;
  variant?: "light" | "dark";
  onReviewPending?: () => void;
  onAuditUpdated?: (audit: FullAuditPayload) => void;
  avgCustomerValue?: number | null;
  currency?: string;
  focusStep?: number | null;
  focusScrollTarget?: "google-updates" | null;
  onFocusHandled?: () => void;
}) {
  const isLight = variant === "light";
  const [syncingGoogleUpdates, setSyncingGoogleUpdates] = useState(false);
  const {
    tasks,
    plan,
    loading,
    error,
    approveAndPublish,
    rejectTask,
    updateDraft,
    checkEditStatus,
    publishPhoto,
    uploadPhotoFile,
    uploadVideoFile,
    uploadPhotoBatch,
    savePhotoPreview,
    ensurePhotoTasks,
    syncGoogleUpdates,
    approveAllRoutine,
    loadingTaskId,
    refresh,
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
      checkEditStatus,
      publishPhoto,
      uploadPhotoFile,
      uploadVideoFile,
      uploadPhotoBatch,
      savePhotoPreview,
      ensurePhotoTasks,
      syncGoogleUpdates,
      approveAllRoutine,
      loadingTaskId,
      error,
    }),
    [
      approveAndPublish,
      rejectTask,
      updateDraft,
      checkEditStatus,
      publishPhoto,
      uploadPhotoFile,
      uploadVideoFile,
      uploadPhotoBatch,
      savePhotoPreview,
      ensurePhotoTasks,
      syncGoogleUpdates,
      approveAllRoutine,
      loadingTaskId,
      error,
    ]
  );

  const refreshGoogleUpdates = useCallback(async () => {
    setSyncingGoogleUpdates(true);
    try {
      const updated = await syncGoogleUpdates();
      if (updated) onAuditUpdated?.(updated);
    } finally {
      setSyncingGoogleUpdates(false);
    }
  }, [onAuditUpdated, syncGoogleUpdates]);

  const defaultExpandedStep = useMemo(() => {
    if (focusStep != null) return focusStep;
    if (!plan) return undefined;
    const needs = plan.steps.find((s) => s.status === "needs_approval");
    return needs?.stepNumber ?? plan.steps.find((s) => s.status === "pending")?.stepNumber;
  }, [focusStep, plan]);

  useEffect(() => {
    if (focusStep == null || loading) return;

    const elementId = planScrollElementId(focusStep, focusScrollTarget ?? undefined);
    const scrollToTarget = () => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        onFocusHandled?.();
      }
    };

    const timer = window.setTimeout(scrollToTarget, 150);
    return () => window.clearTimeout(timer);
  }, [focusScrollTarget, focusStep, loading, onFocusHandled]);

  const path = useMemo(
    () => buildPathToHealthy(audit, plan, { avgCustomerValue, currency }),
    [audit, plan, avgCustomerValue, currency]
  );

  const reviewUrl = useMemo(
    () =>
      googleReviewUrlForBusiness({
        placeId: audit.gbp.identity.placeId,
        mapsUrl: audit.gbp.identity.mapsUrl,
        name: audit.clientName,
        address: audit.gbp.identity.address,
      }),
    [audit.clientName, audit.gbp.identity.address, audit.gbp.identity.mapsUrl, audit.gbp.identity.placeId]
  );

  const handleReviewRequestSent = useCallback(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!gbpConnected || !plan) return;
    const photoStep = plan.steps.find((s) => s.stepNumber === 6);
    if (photoStep && photoStep.tasks.length === 0) {
      void ensurePhotoTasks().catch(() => undefined);
    }
  }, [gbpConnected, plan, ensurePhotoTasks]);

  useEffect(() => {
    if (!gbpConnected || !needsGoogleUpdateRefresh(audit, gbpGoogleUpdateAt)) return;
    void refreshGoogleUpdates().catch(() => undefined);
  }, [audit.auditId, gbpConnected, gbpGoogleUpdateAt, refreshGoogleUpdates]);

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

      <GoogleUpdatesPanel
        audit={audit}
        gbpConnected={gbpConnected}
        actions={actions}
        attributionByTaskId={attributionByTaskId}
        tasks={tasks}
        syncing={syncingGoogleUpdates}
        onRefresh={() => void refreshGoogleUpdates()}
        variant={variant}
      />

      <PlanProgressHeader
        plan={plan}
        variant={variant}
        onReviewPending={onReviewPending}
        estimatedMonthlyRevenue={path?.estimatedMonthlyRevenue}
        projectedMonthlyRevenue={path?.projectedMonthlyRevenue}
        currency={currency}
      />

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
            attributeCoverage={audit.gbp.attributeCoverage}
            placeActionCoverage={audit.gbp.placeActions}
            placeActionLinks={audit.gbp.placeActionLinks}
            defaultExpandedStep={defaultExpandedStep}
            focusStep={focusStep}
            variant={variant}
            currency={currency}
            businessName={audit.clientName}
            reviewUrl={reviewUrl}
            onReviewRequestSent={handleReviewRequestSent}
          />
        );
      })}
    </div>
  );
}
