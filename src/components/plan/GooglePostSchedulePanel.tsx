"use client";

import { useMemo, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";
import {
  datetimeLocalValueToIso,
  failedGooglePostTasks,
  googlePostAwaitingScheduledPublish,
  googlePostCanManageSchedule,
  isoToDatetimeLocalValue,
  minGooglePostScheduleTime,
  upcomingGooglePostTasks,
  validateGooglePostScheduleTime,
} from "@/lib/google/google-post-schedule";
import GooglePostScheduleCalendar from "./GooglePostScheduleCalendar";
import { formatPlanTimestamp } from "./plan-timestamps";

type SchedulePanelActions = Pick<
  PlanTaskActions,
  "cancelScheduledPost" | "rescheduleGooglePost" | "loadingTaskId"
>;

function postSnippet(task: ExecutionTask): string {
  const text = task.draftContent.trim();
  if (!text) return task.title.replace(/^Step \d+: /, "");
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function statusLabel(task: ExecutionTask): string {
  if (task.status === "scheduled" || googlePostAwaitingScheduledPublish(task)) {
    return "Scheduled";
  }
  if (task.status === "pending_approval") {
    return "Draft";
  }
  return task.status.replace(/_/g, " ");
}

export default function GooglePostSchedulePanel({
  tasks,
  actions,
  variant = "light",
  onSelectTask,
}: {
  tasks: ExecutionTask[];
  actions: SchedulePanelActions;
  variant?: "light" | "dark";
  onSelectTask?: (taskId: string) => void;
}) {
  const isLight = variant === "light";
  const upcoming = useMemo(() => upcomingGooglePostTasks(tasks), [tasks]);
  const failed = useMemo(() => failedGooglePostTasks(tasks), [tasks]);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  if (upcoming.length === 0 && failed.length === 0) {
    return null;
  }

  const minLocal = isoToDatetimeLocalValue(minGooglePostScheduleTime().toISOString());
  const loadingTaskId = actions.loadingTaskId;

  function openReschedule(task: ExecutionTask) {
    setRescheduleTaskId(task.id);
    setRescheduleValue(
      task.scheduledFor
        ? isoToDatetimeLocalValue(task.scheduledFor)
        : isoToDatetimeLocalValue(minGooglePostScheduleTime().toISOString())
    );
    setRescheduleError(null);
  }

  function closeReschedule() {
    setRescheduleTaskId(null);
    setRescheduleValue("");
    setRescheduleError(null);
  }

  async function saveReschedule(taskId: string) {
    const iso = datetimeLocalValueToIso(rescheduleValue);
    const error = validateGooglePostScheduleTime(iso);
    if (error) {
      setRescheduleError(error);
      return;
    }
    await actions.rescheduleGooglePost(taskId, iso!);
    closeReschedule();
  }

  return (
    <div
      className={`mb-4 rounded-lg border p-3 ${
        isLight ? "border-[#e8eaed] bg-white" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isLight ? "text-[#80868b]" : "text-slate-500"
          }`}
        >
          Post schedule
        </p>
        <div className="flex rounded-full border p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-full px-3 py-1 ${
              view === "list"
                ? isLight
                  ? "bg-[#e8f0fe] text-[#1a73e8]"
                  : "bg-sky-500/20 text-sky-300"
                : isLight
                  ? "text-[#5f6368]"
                  : "text-slate-400"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={`rounded-full px-3 py-1 ${
              view === "calendar"
                ? isLight
                  ? "bg-[#e8f0fe] text-[#1a73e8]"
                  : "bg-sky-500/20 text-sky-300"
                : isLight
                  ? "text-[#5f6368]"
                  : "text-slate-400"
            }`}
          >
            Calendar
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="mt-3">
          <GooglePostScheduleCalendar
            tasks={tasks}
            variant={variant}
            selectedDateKey={selectedDateKey}
            onSelectDate={setSelectedDateKey}
            onSelectTask={onSelectTask}
          />
        </div>
      ) : (
        upcoming.length > 0 && (
          <ul className="mt-2 space-y-2">
            {upcoming.map((task) => {
              const when = formatPlanTimestamp(task.scheduledFor);
              const loading = loadingTaskId === task.id;
              const canManage = googlePostCanManageSchedule(task);
              const isRescheduling = rescheduleTaskId === task.id;

              return (
                <li
                  key={task.id}
                  className={`rounded-md border px-2 py-2 ${
                    isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/8 bg-white/[0.02]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTask?.(task.id)}
                    className={`flex w-full items-start justify-between gap-3 text-left ${
                      isLight ? "text-[#3c4043]" : "text-slate-200"
                    }`}
                  >
                    <span className="min-w-0 text-sm">{postSnippet(task)}</span>
                    <span className="shrink-0 text-right">
                      <span
                        className={`block text-[10px] font-medium uppercase tracking-wide ${
                          isLight ? "text-[#1a73e8]" : "text-sky-300"
                        }`}
                      >
                        {statusLabel(task)}
                      </span>
                      {when && (
                        <span
                          className={`block text-xs ${
                            isLight ? "text-[#80868b]" : "text-slate-500"
                          }`}
                        >
                          {when}
                        </span>
                      )}
                    </span>
                  </button>

                  {canManage && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => (isRescheduling ? closeReschedule() : openReschedule(task))}
                        className={`rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                          isLight
                            ? "border-[#dadce0] text-[#3c4043]"
                            : "border-white/10 text-slate-300"
                        }`}
                      >
                        {loading ? "Saving…" : isRescheduling ? "Close" : "Reschedule"}
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void actions.cancelScheduledPost(task.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                          isLight ? "text-[#5f6368] hover:bg-[#f1f3f4]" : "text-slate-400 hover:bg-white/5"
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {isRescheduling && (
                    <div className="mt-2">
                      <input
                        type="datetime-local"
                        value={rescheduleValue}
                        min={minLocal}
                        disabled={loading}
                        onChange={(event) => {
                          setRescheduleValue(event.target.value);
                          const iso = datetimeLocalValueToIso(event.target.value);
                          setRescheduleError(validateGooglePostScheduleTime(iso));
                        }}
                        className={`block w-full max-w-xs rounded-lg border px-3 py-2 text-sm ${
                          isLight
                            ? "border-[#dadce0] bg-white text-[#202124]"
                            : "border-white/10 bg-slate-900 text-slate-100"
                        }`}
                      />
                      {rescheduleError && (
                        <p className={`mt-1 text-xs ${isLight ? "text-[#d93025]" : "text-red-300"}`}>
                          {rescheduleError}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={loading || rescheduleError != null}
                        onClick={() => void saveReschedule(task.id)}
                        className="mt-2 rounded-full bg-[#1a73e8] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {loading ? "Saving…" : "Save new time"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      )}

      {failed.length > 0 && (
        <div
          className={
            upcoming.length > 0 || view === "calendar"
              ? `mt-3 border-t pt-3 ${isLight ? "border-[#e8eaed]" : "border-white/8"}`
              : "mt-2"
          }
        >
          <p className={`text-xs font-medium ${isLight ? "text-[#d93025]" : "text-red-300"}`}>
            Failed to publish ({failed.length})
          </p>
          <ul className="mt-2 space-y-2">
            {failed.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onSelectTask?.(task.id)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    isLight ? "text-[#3c4043] hover:bg-[#fce8e6]" : "text-slate-200 hover:bg-red-500/10"
                  }`}
                >
                  {postSnippet(task)}
                  {task.result && (
                    <span className={`mt-0.5 block text-xs ${isLight ? "text-[#d93025]" : "text-red-300"}`}>
                      {task.result}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
