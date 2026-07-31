"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { usePlanTasks, type PlanTasksState } from "@/hooks/usePlanTasks";
import { pendingBatchTasks, pendingRoutineTasks } from "@/lib/execution/pending-tasks";
import PlanBatchTaskEditor, { type PlanBatchTaskEditorContext } from "./PlanBatchTaskEditor";

export default function BatchReviewSession({
  open,
  onClose,
  clientId,
  auditId,
  gbpConnected,
  initialTasks,
  attributionByTaskId = {},
  sharedPlanTasks,
  editorContext = {},
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  auditId: string;
  gbpConnected: boolean;
  initialTasks: ExecutionTask[];
  attributionByTaskId?: Record<string, ActionAttribution>;
  sharedPlanTasks?: PlanTasksState;
  editorContext?: PlanBatchTaskEditorContext;
}) {
  const internalPlanTasks = usePlanTasks({
    clientId,
    auditId,
    initialTasks,
    enabled: open && !sharedPlanTasks,
  });
  const planTasks = sharedPlanTasks ?? internalPlanTasks;
  const {
    tasks,
    loadingTaskId,
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
    approveAllRoutine,
    regenerateReviewResponse,
    cancelScheduledPost,
    rescheduleGooglePost,
    syncGoogleUpdates,
    reconcilePlanNow,
    reconciling,
    refresh,
  } = planTasks;

  const [index, setIndex] = useState(0);
  const [bulkLoading, setBulkLoading] = useState(false);

  const pending = useMemo(() => pendingBatchTasks(tasks), [tasks]);
  const routineCount = useMemo(() => pendingRoutineTasks(tasks).length, [tasks]);
  const current = pending[index];

  useEffect(() => {
    if (!open) {
      setIndex(0);
      return;
    }
    if (!sharedPlanTasks) {
      void refresh();
    }
  }, [open, refresh, sharedPlanTasks]);

  useEffect(() => {
    if (index >= pending.length && pending.length > 0) {
      setIndex(pending.length - 1);
    }
  }, [index, pending.length]);

  const advance = useCallback(async () => {
    const data = await refresh();
    const nextPending = pendingBatchTasks(data.tasks);
    if (nextPending.length === 0) {
      onClose();
    } else {
      setIndex(0);
    }
  }, [refresh, onClose]);

  const actions = useMemo(
    () => ({
      approveAndPublish: async (
        task: ExecutionTask,
        options?: { draftContent?: string; retry?: boolean; payload?: Record<string, unknown> }
      ) => {
        await approveAndPublish(task, options);
        await advance();
      },
      rejectTask: async (taskId: string) => {
        await rejectTask(taskId);
        await advance();
      },
      updateDraft,
      checkEditStatus,
      publishPhoto: async (task: ExecutionTask, preview?: string) => {
        await publishPhoto(task, preview);
        await advance();
      },
      uploadPhotoFile,
      uploadVideoFile,
      uploadPhotoBatch,
      savePhotoPreview,
      ensurePhotoTasks,
      approveAllRoutine,
      regenerateReviewResponse,
      cancelScheduledPost,
      rescheduleGooglePost,
      syncGoogleUpdates,
      reconcilePlanNow,
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
      approveAllRoutine,
      regenerateReviewResponse,
      cancelScheduledPost,
      rescheduleGooglePost,
      syncGoogleUpdates,
      reconcilePlanNow,
      refresh,
      loadingTaskId,
      reconciling,
      error,
      advance,
    ]
  );

  async function handleApproveAllRoutine() {
    setBulkLoading(true);
    try {
      await approveAllRoutine();
      onClose();
    } finally {
      setBulkLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-review-title"
      >
        <header className="flex items-center justify-between border-b border-[#e8eaed] px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#80868b]">
              Batch review
            </p>
            <h2 id="batch-review-title" className="text-lg font-semibold text-[#202124]">
              {pending.length === 0
                ? "All caught up"
                : `Item ${index + 1} of ${pending.length}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {pending.length === 0 ? (
            <p className="text-sm text-[#5f6368]">
              Nothing ready to review right now. Check your Plan for photo tasks still generating.
            </p>
          ) : current ? (
            <PlanBatchTaskEditor
              task={current}
              gbpConnected={gbpConnected}
              actions={actions}
              attribution={attributionByTaskId[current.id]}
              context={editorContext}
              onTaskCompleted={() => void advance()}
            />
          ) : null}

          {error && <p className="mt-3 text-sm text-[#d93025]">{error}</p>}
        </div>

        {routineCount > 1 && (
          <div className="border-t border-[#e8eaed] px-5 py-3">
            <button
              type="button"
              disabled={bulkLoading || Boolean(loadingTaskId)}
              onClick={() => void handleApproveAllRoutine()}
              className="w-full rounded-full border border-[#dadce0] py-2 text-sm font-medium text-[#3c4043] hover:bg-[#f8f9fa] disabled:opacity-50"
            >
              {bulkLoading
                ? "Publishing routine updates…"
                : `Approve all routine (${routineCount} profile updates)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
