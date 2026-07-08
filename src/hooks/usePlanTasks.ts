"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutionTask, FullAuditPayload, Plan } from "@/audit/types";
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
} from "@/lib/execution/client-actions";

interface UsePlanTasksOptions {
  clientId: string;
  auditId: string;
  initialTasks?: ExecutionTask[];
  initialPlan?: Plan | null;
}

export function usePlanTasks({
  clientId,
  auditId,
  initialTasks = [],
  initialPlan = null,
}: UsePlanTasksOptions) {
  const [tasks, setTasks] = useState<ExecutionTask[]>(initialTasks);
  const [plan, setPlan] = useState<Plan | null>(initialPlan);
  const [loading, setLoading] = useState(!initialPlan && initialTasks.length === 0);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await fetchExecutionState(clientId, auditId);
    setTasks(data.tasks);
    setPlan(data.plan);
    return data;
  }, [clientId, auditId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchExecutionState(clientId, auditId);
        if (!cancelled) {
          setTasks(data.tasks);
          setPlan(data.plan);
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
  }, [clientId, auditId]);

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
          previewDataUrl ?? (typeof task.payload.previewDataUrl === "string" ? task.payload.previewDataUrl : undefined)
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

  return {
    tasks,
    plan,
    loading,
    loadingTaskId,
    error,
    setError,
    refresh,
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
  };
}

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
  | "loadingTaskId"
  | "error"
>;
