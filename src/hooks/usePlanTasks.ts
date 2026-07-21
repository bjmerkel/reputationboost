"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExecutionTask, FullAuditPayload, Plan } from "@/audit/types";
import type { MarketActionCalibration } from "@/audit/autopilot/market-calibration";
import type { AttributionCalibration } from "@/audit/phase2/attribution-calibration";
import type { UserNotification } from "@/audit/storage-notifications";
import {
  approveAllRoutineTasks,
  approveAndPublishTask,
  checkTaskEditStatus,
  fetchExecutionState,
  patchExecutionTask,
  publishPhotoFile,
  publishPhotoTask,
  publishVideoFile,
  publishPhotoBatch,
  regenerateReviewResponseTask,
  reconcilePlan,
} from "@/lib/execution/client-actions";
import { executionTasksEqual } from "@/lib/execution/task-equality";
import { trackPlanEvent } from "@/lib/analytics/plan-events";

interface UsePlanTasksOptions {
  clientId: string;
  auditId: string;
  initialTasks?: ExecutionTask[];
  initialPlan?: Plan | null;
  initialPlanReconciledAt?: string | null;
  enabled?: boolean;
  includePlan?: boolean;
}

export function usePlanTasks({
  clientId,
  auditId,
  initialTasks = [],
  initialPlan = null,
  initialPlanReconciledAt = null,
  enabled = true,
  includePlan = true,
}: UsePlanTasksOptions) {
  const initialTasksRef = useRef(initialTasks);
  const initialPlanRef = useRef(initialPlan);
  initialTasksRef.current = initialTasks;
  initialPlanRef.current = initialPlan;

  const [tasks, setTasks] = useState<ExecutionTask[]>(initialTasks);
  const [plan, setPlan] = useState<Plan | null>(initialPlan);
  const [planReconciledAt, setPlanReconciledAt] = useState<string | null>(
    initialPlanReconciledAt
  );
  const [marketActionCalibration, setMarketActionCalibration] = useState<
    MarketActionCalibration[]
  >([]);
  const [experimentStepCalibration, setExperimentStepCalibration] = useState<
    AttributionCalibration
  >({});
  const [winningStepsByKeyword, setWinningStepsByKeyword] = useState<Record<string, number>>(
    {}
  );
  const [unreadNotifications, setUnreadNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(!initialPlan && initialTasks.length === 0);
  const [reconciling, setReconciling] = useState(false);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !auditId) {
      return {
        tasks: initialTasksRef.current,
        plan: initialPlanRef.current,
        planReconciledAt: null as string | null,
      };
    }
    const data = await fetchExecutionState(clientId, auditId, { includePlan });
    setTasks((prev) => (executionTasksEqual(prev, data.tasks) ? prev : data.tasks));
    if (includePlan) {
      setPlan(data.plan);
      setMarketActionCalibration(data.marketActionCalibration ?? []);
      setExperimentStepCalibration(data.experimentStepCalibration ?? {});
      setWinningStepsByKeyword(data.winningStepsByKeyword ?? {});
      setUnreadNotifications(data.unreadNotifications ?? []);
    }
    setPlanReconciledAt(data.planReconciledAt);
    return data;
  }, [auditId, clientId, enabled, includePlan]);

  const prevIncludePlanRef = useRef(includePlan);

  useEffect(() => {
    if (!enabled || !auditId) {
      setTasks(initialTasksRef.current);
      setPlan(initialPlanRef.current);
      setLoading(false);
      return;
    }

    const includePlanUpgraded = !prevIncludePlanRef.current && includePlan;
    prevIncludePlanRef.current = includePlan;

    const hasInitialTasks = initialTasksRef.current.length > 0;
    const hasInitialPlan = initialPlanRef.current != null;
    if (hasInitialTasks && !includePlanUpgraded && (!includePlan || hasInitialPlan)) {
      setTasks(initialTasksRef.current);
      if (includePlan && hasInitialPlan) {
        setPlan(initialPlanRef.current);
      }
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchExecutionState(clientId, auditId, { includePlan });
        if (!cancelled) {
          setTasks((prev) => (executionTasksEqual(prev, data.tasks) ? prev : data.tasks));
          if (includePlan) {
            setPlan(data.plan);
            setMarketActionCalibration(data.marketActionCalibration ?? []);
          }
          setPlanReconciledAt(data.planReconciledAt);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load plan");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [auditId, clientId, enabled, includePlan]);

  const runWithLoading = useCallback(
    async (taskId: string, action: () => Promise<void>) => {
      setLoadingTaskId(taskId);
      setError(null);
      try {
        await action();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
        throw e;
      } finally {
        setLoadingTaskId(null);
      }
    },
    [refresh]
  );

  const approveAndPublish = useCallback(
    (task: ExecutionTask, options?: { draftContent?: string; retry?: boolean; payload?: Record<string, unknown> }) =>
      runWithLoading(task.id, () =>
        approveAndPublishTask(task, options).then(() => undefined)
      ),
    [runWithLoading]
  );

  const rejectTask = useCallback(
    (taskId: string) => runWithLoading(taskId, () => patchExecutionTask(taskId, { status: "rejected" }).then(() => undefined)),
    [runWithLoading]
  );

  const updateDraft = useCallback(
    (taskId: string, draftContent: string) =>
      runWithLoading(taskId, () => patchExecutionTask(taskId, { draftContent }).then(() => undefined)),
    [runWithLoading]
  );

  const checkEditStatus = useCallback(
    (taskId: string) =>
      runWithLoading(taskId, () => checkTaskEditStatus(taskId).then(() => undefined)),
    [runWithLoading]
  );

  const publishPhoto = useCallback(
    (task: ExecutionTask, previewDataUrl?: string) =>
      runWithLoading(task.id, () =>
        publishPhotoTask(
          task.id,
          previewDataUrl ?? (typeof task.payload.previewDataUrl === "string" ? task.payload.previewDataUrl : undefined),
          String(task.payload.category ?? "ADDITIONAL")
        ).then(() => undefined)
      ),
    [runWithLoading]
  );

  const uploadPhotoFile = useCallback(
    (task: ExecutionTask, file: File) =>
      runWithLoading(task.id, () =>
        publishPhotoFile(task.id, file, String(task.payload.category ?? "ADDITIONAL")).then(() => undefined)
      ),
    [runWithLoading]
  );

  const uploadVideoFile = useCallback(
    (task: ExecutionTask, file: File) =>
      runWithLoading(task.id, () =>
        publishVideoFile(task.id, file, String(task.payload.category ?? "AT_WORK")).then(() => undefined)
      ),
    [runWithLoading]
  );

  const uploadPhotoBatch = useCallback(
    async (files: File[], categories: string[]) => {
      setError(null);
      try {
        const result = await publishPhotoBatch(files, categories);
        await refresh();
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Batch upload failed");
        throw e;
      }
    },
    [refresh]
  );

  const savePhotoPreview = useCallback(
    (taskId: string, previewDataUrl: string) =>
      runWithLoading(taskId, () =>
        patchExecutionTask(taskId, { payload: { previewDataUrl } }).then(() => undefined)
      ),
    [runWithLoading]
  );

  const ensurePhotoTasks = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/execution/ensure-photo-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, auditId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to create photo tasks");
    await refresh();
    return data.tasks as ExecutionTask[];
  }, [auditId, clientId, refresh]);

  const syncGoogleUpdates = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/google/gbp/google-updated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, auditId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to refresh Google updates");
    await refresh();
    return data.audit as FullAuditPayload;
  }, [auditId, clientId, refresh]);

  const regenerateReviewResponse = useCallback(
    (task: ExecutionTask, options?: { weaveKeyword?: boolean; keyword?: string }) =>
      runWithLoading(task.id, () =>
        regenerateReviewResponseTask(task.id, options).then(() => undefined)
      ),
    [runWithLoading]
  );

  const approveAllRoutine = useCallback(async () => {
    setError(null);
    try {
      const count = await approveAllRoutineTasks(tasks);
      await refresh();
      return count;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk approve failed");
      throw e;
    }
  }, [tasks, refresh]);

  const reconcilePlanNow = useCallback(async (options?: { live?: boolean }) => {
    setReconciling(true);
    setError(null);
    try {
      const result = await reconcilePlan(clientId, auditId, options);
      if (result.planReconciledAt) {
        setPlanReconciledAt(result.planReconciledAt);
      }
      if (options?.live) {
        trackPlanEvent({
          name: "plan_reconcile_live",
          auditId,
          meta: {
            completedTasks: result.completedTasks ?? 0,
            createdTasks: result.createdTasks ?? 0,
          },
        });
      }
      await refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh plan");
      throw e;
    } finally {
      setReconciling(false);
    }
  }, [auditId, clientId, refresh]);

  return {
    tasks,
    plan,
    planReconciledAt,
    marketActionCalibration,
    experimentStepCalibration,
    winningStepsByKeyword,
    unreadNotifications,
    loading,
    reconciling,
    loadingTaskId,
    error,
    setError,
    refresh,
    reconcilePlanNow,
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
  };
}

export type PlanTasksState = ReturnType<typeof usePlanTasks>;

export type PlanTaskActions = Pick<
  ReturnType<typeof usePlanTasks>,
  | "approveAndPublish"
  | "rejectTask"
  | "updateDraft"
  | "checkEditStatus"
  | "publishPhoto"
  | "uploadPhotoFile"
  | "uploadVideoFile"
  | "uploadPhotoBatch"
  | "savePhotoPreview"
  | "ensurePhotoTasks"
  | "syncGoogleUpdates"
  | "approveAllRoutine"
  | "regenerateReviewResponse"
  | "reconcilePlanNow"
  | "refresh"
  | "loadingTaskId"
  | "reconciling"
  | "error"
>;
