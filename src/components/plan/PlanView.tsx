"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FullAuditPayload } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import {
  buildAttributionCalibration,
  buildGapAttributionCalibration,
  mergeCalibrations,
  type AttributionCalibration,
} from "@/audit/phase2/attribution-calibration";
import { auditNeedsSoftConversionBoost, auditNeedsReviewVelocityBoost, auditPrefersConversionOverRank } from "@/audit/phase2/conversion-boost";
import { buildPathToHealthy } from "@/audit/phase2/path-to-healthy";
import { planScrollElementId } from "@/lib/google/gbp-field-plan-links";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { usePlanTasks, type PlanTasksState } from "@/hooks/usePlanTasks";
import { planApprovalBadgeCount } from "@/lib/execution/pending-counts";
import {
  consumePlanRefreshAfterAcvSave,
  hasPlanRefreshAfterAcvSave,
} from "@/components/results/results-focus";
import GoogleUpdatesPanel from "./GoogleUpdatesPanel";
import GoogleUpdatesCompactBanner, {
  GoogleUpdatesConflictLink,
} from "./GoogleUpdatesCompactBanner";
import PlanAcvNudge from "./PlanAcvNudge";
import PlanKeywordPlaybooks from "./PlanKeywordPlaybooks";
import PlanMaintenanceCadence from "./PlanMaintenanceCadence";
import PlanNextBestActions from "./PlanNextBestActions";
import PlanPhaseSection from "./PlanPhaseSection";
import PlanProgressHeader from "./PlanProgressHeader";
import { planGbpBannerMessage, reconcileFeedbackMessage, liveSyncFeedbackMessage, planHasManualSteps } from "./plan-ux-copy";
import {
  buildAcvRevenuePreview,
  resolveGoogleUpdatesPresentation,
} from "./plan-viewport";
import {
  markManualPlanSynced,
  readLastManualPlanSyncAt,
  shouldAutoLiveSyncManualPlan,
} from "./plan-manual-sync";

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
  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);
  const acvRefreshStartedRef = useRef(false);
  const manualLiveSyncInFlightRef = useRef(false);
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

  const handleManualPlanRefresh = useCallback(() => {
    void reconcilePlanNow({ live: true })
      .then((result) => {
        markManualPlanSynced(audit.auditId);
        setReconcileNotice(
          liveSyncFeedbackMessage({
            gbpRefreshed: result.gbpRefreshed === true,
            completedTasks: result.completedTasks,
            createdTasks: result.createdTasks,
          })
        );
        if (result.audit) onAuditUpdated?.(result.audit);
      })
      .catch(() => undefined);
  }, [audit.auditId, onAuditUpdated, reconcilePlanNow]);

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
      manualPlanRefresh: handleManualPlanRefresh,
      refresh,
      loadingTaskId,
      reconciling,
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
      handleManualPlanRefresh,
      refresh,
      loadingTaskId,
      reconciling,
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

  const runManualLiveSync = useCallback(() => {
    if (loading || reconciling || manualLiveSyncInFlightRef.current || !plan || !gbpConnected) {
      return;
    }
    if (!planHasManualSteps(plan)) return;
    if (
      !shouldAutoLiveSyncManualPlan({
        gbpConnected,
        hasManualSteps: true,
        lastSyncAt: readLastManualPlanSyncAt(audit.auditId),
      })
    ) {
      return;
    }

    manualLiveSyncInFlightRef.current = true;
    void reconcilePlanNow({ live: true })
      .then((result) => {
        markManualPlanSynced(audit.auditId);
        setReconcileNotice(
          liveSyncFeedbackMessage({
            gbpRefreshed: result.gbpRefreshed === true,
            completedTasks: result.completedTasks,
            createdTasks: result.createdTasks,
          })
        );
        if (result.audit) onAuditUpdated?.(result.audit);
      })
      .catch(() => undefined)
      .finally(() => {
        manualLiveSyncInFlightRef.current = false;
      });
  }, [
    audit.auditId,
    gbpConnected,
    loading,
    onAuditUpdated,
    plan,
    reconcilePlanNow,
    reconciling,
  ]);

  useEffect(() => {
    runManualLiveSync();
  }, [runManualLiveSync]);

  useEffect(() => {
    if (!plan || !gbpConnected || !planHasManualSteps(plan)) return;

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      runManualLiveSync();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [gbpConnected, plan, runManualLiveSync]);

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
      }
      // Always clear so deep-links never hang when the step card is missing.
      onFocusHandled?.();
    };

    const timer = window.setTimeout(scrollToTarget, 150);
    return () => window.clearTimeout(timer);
  }, [focusScrollTarget, focusStep, loading, onFocusHandled]);

  // After Settings saves ACV, reconcile once so $/mo order updates without cron.
  useEffect(() => {
    if (loading || reconciling) return;
    if (avgCustomerValue == null || avgCustomerValue <= 0) return;
    if (acvRefreshStartedRef.current) return;
    if (!hasPlanRefreshAfterAcvSave()) return;

    acvRefreshStartedRef.current = true;
    void reconcilePlanNow()
      .then((result) => {
        consumePlanRefreshAfterAcvSave();
        setReconcileNotice(
          reconcileFeedbackMessage({
            completedTasks: result.completedTasks,
            createdTasks: result.createdTasks,
          })
        );
        if (result.audit) onAuditUpdated?.(result.audit);
      })
      .catch(() => {
        // Allow a retry on the next visit if reconcile failed.
        acvRefreshStartedRef.current = false;
      });
  }, [
    avgCustomerValue,
    loading,
    reconciling,
    reconcilePlanNow,
    onAuditUpdated,
  ]);

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

  const gbpBannerMessage = useMemo(
    () => (plan ? planGbpBannerMessage(plan, gbpConnected) : null),
    [gbpConnected, plan]
  );

  const googleUpdates = useMemo(
    () => resolveGoogleUpdatesPresentation(audit, tasks),
    [audit, tasks]
  );

  const acvRevenuePreview = useMemo(
    () =>
      !avgCustomerValue
        ? buildAcvRevenuePreview(audit, {
            nextThreeProjectedMonthlyLeads: path?.nextThreeProjectedMonthlyLeads,
            nextThreeEstimatedMonthlyLeads: path?.nextThreeEstimatedMonthlyLeads,
            projectedMonthlyLeads: path?.projectedMonthlyLeads,
            estimatedMonthlyLeads: path?.estimatedMonthlyLeads,
          })
        : null,
    [audit, avgCustomerValue, path]
  );

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
      {gbpBannerMessage && (
        <div className="rounded-lg border border-[#ceead6] bg-[#e6f4ea] px-4 py-3 text-sm text-[#137333]">
          {gbpBannerMessage}
        </div>
      )}

      <PlanProgressHeader
        plan={plan}
        variant={variant}
        onReviewPending={onReviewPending}
        pendingApprovalCount={pendingApprovalCount}
        estimatedMonthlyRevenue={path?.estimatedMonthlyRevenue}
        projectedMonthlyRevenue={path?.projectedMonthlyRevenue}
        estimatedMonthlyLeads={path?.estimatedMonthlyLeads}
        projectedMonthlyLeads={path?.projectedMonthlyLeads}
        estimatedMonthlyActions={path?.estimatedMonthlyActions}
        projectedMonthlyActions={path?.projectedMonthlyActions}
        pathStepCount={path?.pathStepCount}
        nextThreeStepCount={path?.nextThreeStepCount}
        nextThreeEstimatedMonthlyRevenue={path?.nextThreeEstimatedMonthlyRevenue}
        nextThreeProjectedMonthlyRevenue={path?.nextThreeProjectedMonthlyRevenue}
        nextThreeEstimatedMonthlyLeads={path?.nextThreeEstimatedMonthlyLeads}
        nextThreeProjectedMonthlyLeads={path?.nextThreeProjectedMonthlyLeads}
        nextThreeEstimatedMonthlyActions={path?.nextThreeEstimatedMonthlyActions}
        nextThreeProjectedMonthlyActions={path?.nextThreeProjectedMonthlyActions}
        currency={currency}
        planReconciledAt={planReconciledAt ?? audit.strategy?.planReconciledAt ?? null}
        calibrationConfidence={path?.calibrationConfidence}
      />

      {reconcileNotice && !error && (
        <p className={`text-sm ${isLight ? "text-[#137333]" : "text-emerald-400"}`}>{reconcileNotice}</p>
      )}

      {googleUpdates.mode === "compact" && (
        <GoogleUpdatesCompactBanner
          pendingCount={googleUpdates.pendingCount}
          variant={variant}
          syncing={syncingGoogleUpdates}
          onRefresh={() => void refreshGoogleUpdates()}
        />
      )}

      {googleUpdates.mode === "full" && (
        <GoogleUpdatesConflictLink
          conflictCount={googleUpdates.conflictCount}
          diffCount={googleUpdates.diffCount}
          variant={variant}
        />
      )}

      {!avgCustomerValue && (
        <PlanAcvNudge
          variant={variant}
          revenuePreview={acvRevenuePreview}
          currency={currency}
        />
      )}

      <PlanNextBestActions
        plan={plan}
        currency={currency}
        variant={variant}
        calibration={calibration}
        preferConversionSteps={auditPrefersConversionOverRank(audit)}
        softConversionBoost={auditNeedsSoftConversionBoost(audit)}
        reviewVelocityBoost={auditNeedsReviewVelocityBoost(audit)}
        onFocusStep={(stepNumber) => setLocalFocusStep(stepNumber)}
      />

      <PlanKeywordPlaybooks
        audit={audit}
        plan={plan}
        avgCustomerValue={avgCustomerValue}
        calibration={calibration}
        currency={currency}
        variant={variant}
        onFocusKeyword={(_keyword, stepNumber) => {
          if (stepNumber == null) return;
          setLocalFocusStep(stepNumber);
        }}
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

      {googleUpdates.mode === "full" && (
        <GoogleUpdatesPanel
          audit={audit}
          tasks={tasks}
          syncing={syncingGoogleUpdates}
          onRefresh={() => void refreshGoogleUpdates()}
          variant={variant}
        />
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

      <PlanMaintenanceCadence
        weeklyCadence={audit.strategy.gbpPlan?.weeklyCadence ?? []}
        monthlyCadence={audit.strategy.gbpPlan?.monthlyCadence ?? []}
        variant={variant}
      />
    </div>
  );
}
