"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FullAuditPayload } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import {
  buildAttributionCalibration,
  buildGapAttributionCalibration,
  mergeCalibrations,
  type AttributionCalibration,
} from "@/audit/phase2/attribution-calibration";
import { buildPathToHealthy } from "@/audit/phase2/path-to-healthy";
import { planScrollElementId } from "@/lib/google/gbp-field-plan-links";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { usePlanTasks, type PlanTasksState } from "@/hooks/usePlanTasks";
import { planApprovalBadgeCount } from "@/lib/execution/pending-counts";
import GoogleUpdatesPanel from "./GoogleUpdatesPanel";
import PlanAcvNudge from "./PlanAcvNudge";
import PlanKeywordPriority from "./PlanKeywordPriority";
import PlanNextBestActions from "./PlanNextBestActions";
import PlanPhaseSection from "./PlanPhaseSection";
import PlanProgressHeader from "./PlanProgressHeader";

export default function PlanView({
  audit,
  clientId,
  gbpConnected = true,
  gbpGoogleUpdateAt,
  attributionByTaskId = {},
  attributions = [],
  globalCalibration = {},
  variant = "light",
  onReviewPending,
  onAuditUpdated,
  avgCustomerValue,
  currency = "USD",
  focusStep = null,
  focusScrollTarget = null,
  focusKeyword = null,
  onFocusHandled,
  sharedPlanTasks,
  onSeeResults,
}: {
  audit: FullAuditPayload;
  clientId: string;
  gbpConnected?: boolean;
  gbpGoogleUpdateAt?: string | null;
  attributionByTaskId?: Record<string, ActionAttribution>;
  attributions?: ActionAttribution[];
  globalCalibration?: AttributionCalibration;
  variant?: "light" | "dark";
  onReviewPending?: () => void;
  onAuditUpdated?: (audit: FullAuditPayload) => void;
  avgCustomerValue?: number | null;
  currency?: string;
  focusStep?: number | null;
  focusScrollTarget?: "google-updates" | null;
  focusKeyword?: string | null;
  onFocusHandled?: () => void;
  sharedPlanTasks?: PlanTasksState;
  onSeeResults?: (stepNumber?: number) => void;
}) {
  const isLight = variant === "light";
  const [syncingGoogleUpdates, setSyncingGoogleUpdates] = useState(false);
  const [localFocusStep, setLocalFocusStep] = useState<number | null>(null);
  const internalPlanTasks = usePlanTasks({
    clientId,
    auditId: audit.auditId,
    initialTasks: audit.execution?.tasks ?? [],
    initialPlanReconciledAt: audit.strategy?.planReconciledAt ?? null,
    enabled: !sharedPlanTasks,
  });
  const {
    tasks,
    plan,
    planReconciledAt,
    loading,
    reconciling,
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
    regenerateReviewResponse,
    loadingTaskId,
    refresh,
    reconcilePlanNow,
  } = sharedPlanTasks ?? internalPlanTasks;

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
      regenerateReviewResponse,
      reconcilePlanNow,
      refresh,
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
      regenerateReviewResponse,
      reconcilePlanNow,
      refresh,
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

  const pendingApprovalCount = planApprovalBadgeCount(tasks);

  const defaultExpandedStep = useMemo(() => {
    if (localFocusStep != null) return localFocusStep;
    if (focusStep != null) return focusStep;
    if (!plan) return undefined;
    const needs = plan.steps.find((s) => s.status === "needs_approval");
    return needs?.stepNumber ?? plan.steps.find((s) => s.status === "pending")?.stepNumber;
  }, [focusStep, localFocusStep, plan]);

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

  const businessCalibration = useMemo(
    () => buildAttributionCalibration(attributions),
    [attributions]
  );
  const gapCalibration = useMemo(
    () => buildGapAttributionCalibration(attributions),
    [attributions]
  );
  const calibration = useMemo(
    () => mergeCalibrations(businessCalibration, globalCalibration),
    [businessCalibration, globalCalibration]
  );
  const path = useMemo(
    () =>
      buildPathToHealthy(audit, plan, {
        avgCustomerValue,
        currency,
        calibration,
        gapCalibration,
      }),
    [audit, plan, avgCustomerValue, currency, calibration, gapCalibration]
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
        pendingApprovalCount={pendingApprovalCount}
        estimatedMonthlyRevenue={path?.estimatedMonthlyRevenue}
        projectedMonthlyRevenue={path?.projectedMonthlyRevenue}
        currency={currency}
        planReconciledAt={planReconciledAt ?? audit.strategy?.planReconciledAt ?? null}
        calibrationConfidence={path?.calibrationConfidence}
        onRefreshPlan={() => {
          void reconcilePlanNow()
            .then((result) => {
              if (result.audit) onAuditUpdated?.(result.audit);
            })
            .catch(() => undefined);
        }}
        refreshingPlan={reconciling}
      />

      {!avgCustomerValue && <PlanAcvNudge variant={variant} />}

      <PlanNextBestActions
        plan={plan}
        currency={currency}
        variant={variant}
        onFocusStep={(stepNumber) => setLocalFocusStep(stepNumber)}
      />

      {(plan.planRationale || plan.objective) && (
        <aside
          className={`rounded-xl border px-4 py-3 ${
            isLight ? "border-[#e8f0fe] bg-[#f8fbff]" : "border-sky-400/20 bg-sky-400/10"
          }`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${
              isLight ? "text-[#1a73e8]" : "text-sky-300"
            }`}
          >
            Why this plan
          </p>
          <p
            className={`mt-1 text-sm leading-relaxed ${
              isLight ? "text-[#3c4043]" : "text-slate-200"
            }`}
          >
            {plan.planRationale || plan.objective}
          </p>
        </aside>
      )}

      <PlanKeywordPriority
        audit={audit}
        plan={plan}
        avgCustomerValue={avgCustomerValue}
        currency={currency}
        variant={variant}
        onFocusKeyword={(_keyword, stepNumber) => {
          if (stepNumber == null) return;
          setLocalFocusStep(stepNumber);
          const el = document.getElementById(`plan-step-${stepNumber}`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      {audit.strategy?.executiveSummary && (
        <p className={`text-sm leading-relaxed ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
          {audit.strategy.executiveSummary}
        </p>
      )}

      {error && <p className="text-sm text-[#d93025]">{error}</p>}

      {plan.phases.map((phase) => {
        const phaseSteps = plan.steps
          .filter((s) => s.phaseId === phase.id)
          .sort(
            (a, b) =>
              (a.displayOrder ?? a.stepNumber) - (b.displayOrder ?? b.stepNumber)
          );
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
            focusKeyword={focusKeyword}
            variant={variant}
            currency={currency}
            businessName={audit.clientName}
            businessPhone={audit.gbp.identity.phone}
            businessWebsite={audit.gbp.identity.website}
            reviewUrl={reviewUrl}
            onReviewRequestSent={handleReviewRequestSent}
            onSeeResults={onSeeResults}
          />
        );
      })}
    </div>
  );
}
