"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { resolvePlanStepNumber } from "@/audit/phase3/plan-task-utils";
import { usePlanTasks } from "@/hooks/usePlanTasks";
import { pendingBatchTasks, pendingRoutineTasks } from "@/lib/execution/pending-tasks";
import { normalizeTextContent } from "@/lib/llm/normalize-content";
import MediaTaskThumbnail, { isMediaMaintenanceTask } from "./MediaTaskThumbnail";
import PlanStepHours from "./PlanStepHours";

export default function BatchReviewSession({
  open,
  onClose,
  clientId,
  auditId,
  gbpConnected,
  initialTasks,
  attributionByTaskId = {},
  onTasksChange,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  auditId: string;
  gbpConnected: boolean;
  initialTasks: ExecutionTask[];
  attributionByTaskId?: Record<string, ActionAttribution>;
  onTasksChange?: () => void;
}) {
  const {
    tasks,
    loadingTaskId,
    error,
    approveAndPublish,
    rejectTask,
    updateDraft,
    publishPhoto,
    uploadPhotoFile,
    savePhotoPreview,
    ensurePhotoTasks,
    approveAllRoutine,
    refresh,
  } = usePlanTasks({ clientId, auditId, initialTasks });

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
    void refresh().then(() => onTasksChange?.());
  }, [open, onTasksChange, refresh]);

  useEffect(() => {
    onTasksChange?.();
  }, [onTasksChange, tasks]);

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
        advance();
      },
      rejectTask: async (taskId: string) => {
        await rejectTask(taskId);
        advance();
      },
      updateDraft,
      publishPhoto: async (task: ExecutionTask, preview?: string) => {
        await publishPhoto(task, preview);
        advance();
      },
      uploadPhotoFile,
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
      savePhotoPreview,
      ensurePhotoTasks,
      approveAllRoutine,
      loadingTaskId,
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
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
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
            current.type === "gbp_hours" ? (
              <PlanStepHours task={current} gbpConnected={gbpConnected} actions={actions} />
            ) : (
              <BatchReviewItem task={current} gbpConnected={gbpConnected} />
            )
          ) : null}

          {error && <p className="mt-3 text-sm text-[#d93025]">{error}</p>}
        </div>

        {pending.length > 0 && current && current.type !== "gbp_hours" && (
          <footer className="space-y-3 border-t border-[#e8eaed] px-5 py-4">
            {current.type === "gbp_photo" && typeof current.payload.previewDataUrl === "string" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(current.payload.previewDataUrl)}
                alt=""
                className="mb-3 aspect-[3/2] w-full rounded-lg object-cover"
              />
            )}
            {isMediaMaintenanceTask(current) && (
              <div className="mb-3">
                <MediaTaskThumbnail
                  task={current}
                  className="aspect-[3/2] w-full rounded-lg object-cover"
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {current.type !== "gbp_photo" && gbpConnected && (
                <button
                  type="button"
                  disabled={loadingTaskId === current.id}
                  onClick={() => void actions.approveAndPublish(current)}
                  className="btn-primary rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loadingTaskId === current.id ? "Publishing…" : "Approve & publish"}
                </button>
              )}
              {current.type === "gbp_photo" && gbpConnected && (
                <button
                  type="button"
                  disabled={loadingTaskId === current.id}
                  onClick={() => void actions.approveAndPublish(current)}
                  className="btn-primary rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loadingTaskId === current.id ? "Uploading…" : "Approve & publish"}
                </button>
              )}
              <button
                type="button"
                disabled={loadingTaskId === current.id}
                onClick={() => void actions.rejectTask(current.id)}
                className="rounded-full px-5 py-2 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-50"
              >
                Skip
              </button>
            </div>
          </footer>
        )}

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

function BatchReviewItem({
  task,
  gbpConnected,
}: {
  task: ExecutionTask;
  gbpConnected: boolean;
}) {
  const stepNumber = resolvePlanStepNumber(task);
  const expectedEffect =
    typeof task.payload.expectedEffect === "string" ? task.payload.expectedEffect : null;
  const suggestedKeyword =
    typeof task.payload.suggestedKeyword === "string" ? task.payload.suggestedKeyword : null;
  const keywordsHit = Array.isArray(task.payload.keywordsHit)
    ? task.payload.keywordsHit.filter((value): value is string => typeof value === "string")
    : [];
  const weaveSkipped = task.payload.weaveSkipped === true;
  const weaveReason =
    typeof task.payload.weaveReason === "string" ? task.payload.weaveReason : null;

  return (
    <div className="space-y-3">
      {stepNumber != null && (
        <p className="text-xs font-medium text-[#80868b]">
          From plan step {stepNumber}
          {typeof task.payload.gbpStepTitle === "string"
            ? ` — ${task.payload.gbpStepTitle}`
            : ""}
        </p>
      )}
      <h3 className="text-base font-semibold text-[#202124]">{task.title}</h3>
      {keywordsHit.length > 0 && (
        <p className="text-sm text-[#188038]">
          Mentions {keywordsHit.map((keyword) => `"${keyword}"`).join(", ")}
        </p>
      )}
      {suggestedKeyword && keywordsHit.length === 0 && weaveSkipped && (
        <p className="text-sm text-[#80868b]">No keyword added — reply stays natural.</p>
      )}
      {suggestedKeyword && keywordsHit.length === 0 && !weaveSkipped && (
        <p className="text-sm text-[#5f6368]">
          Could mention: &ldquo;{suggestedKeyword}&rdquo;
        </p>
      )}
      {weaveReason && (
        <p className="text-sm text-[#3c4043]">
          <span className="font-medium">Why: </span>
          {weaveReason}
        </p>
      )}
      {expectedEffect && !weaveReason && (
        <p className="text-sm text-[#3c4043]">
          <span className="font-medium">Why: </span>
          {expectedEffect}
        </p>
      )}
      {isMediaMaintenanceTask(task) && <MediaTaskThumbnail task={task} />}
      {task.type !== "gbp_photo" && (
        <p className="whitespace-pre-wrap rounded-lg bg-[#f8f9fa] p-3 text-sm text-[#3c4043]">
          {normalizeTextContent(task.draftContent)}
        </p>
      )}
      {!gbpConnected && (
        <p className="text-xs text-[#80868b]">Connect Google Business Profile to publish.</p>
      )}
    </div>
  );
}
