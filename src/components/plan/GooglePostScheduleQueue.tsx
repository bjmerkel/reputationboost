"use client";

import type { ExecutionTask } from "@/audit/types";
import {
  failedGooglePostTasks,
  googlePostAwaitingScheduledPublish,
  upcomingGooglePostTasks,
} from "@/lib/google/google-post-schedule";
import { formatPlanTimestamp } from "./plan-timestamps";

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

export default function GooglePostScheduleQueue({
  tasks,
  variant = "light",
  onSelectTask,
}: {
  tasks: ExecutionTask[];
  variant?: "light" | "dark";
  onSelectTask?: (taskId: string) => void;
}) {
  const isLight = variant === "light";
  const upcoming = upcomingGooglePostTasks(tasks);
  const failed = failedGooglePostTasks(tasks);

  if (upcoming.length === 0 && failed.length === 0) {
    return null;
  }

  return (
    <div
      className={`mb-4 rounded-lg border p-3 ${
        isLight ? "border-[#e8eaed] bg-white" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
        Post schedule
      </p>

      {upcoming.length > 0 && (
        <ul className="mt-2 space-y-2">
          {upcoming.map((task) => {
            const when = formatPlanTimestamp(task.scheduledFor);
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onSelectTask?.(task.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-md px-2 py-1.5 text-left transition ${
                    isLight ? "hover:bg-[#f1f3f4]" : "hover:bg-white/5"
                  }`}
                >
                  <span className={`min-w-0 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-200"}`}>
                    {postSnippet(task)}
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block text-[10px] font-medium uppercase tracking-wide ${
                        isLight ? "text-[#1a73e8]" : "text-sky-300"
                      }`}
                    >
                      {statusLabel(task)}
                    </span>
                    {when && (
                      <span className={`block text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                        {when}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {failed.length > 0 && (
        <div className={upcoming.length > 0 ? `mt-3 border-t pt-3 ${isLight ? "border-[#e8eaed]" : "border-white/8"}` : "mt-2"}>
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
