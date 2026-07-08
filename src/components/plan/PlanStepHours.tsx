"use client";

import type { ExecutionTask } from "@/audit/types";
import {
  defaultUsHolidayDescriptions,
  defaultWeekdayHours,
  formatRegularHoursSummary,
} from "@/lib/google/gbp-hours";

type HoursTaskActions = {
  loadingTaskId: string | null;
  approveAndPublish: (task: ExecutionTask) => Promise<unknown>;
  rejectTask: (taskId: string) => Promise<unknown>;
};

function hoursAction(task: ExecutionTask): "update_regular_hours" | "update_holiday_hours" {
  return task.payload.hoursAction === "update_regular_hours"
    ? "update_regular_hours"
    : "update_holiday_hours";
}

export default function PlanStepHours({
  task,
  gbpConnected,
  actions,
  variant = "light",
}: {
  task: ExecutionTask;
  gbpConnected: boolean;
  actions: HoursTaskActions;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const loading = actions.loadingTaskId === task.id;
  const action = hoursAction(task);
  const year =
    typeof task.payload.holidayYear === "number"
      ? task.payload.holidayYear
      : new Date().getFullYear();
  const holidays = defaultUsHolidayDescriptions(year);
  const regularHours = defaultWeekdayHours();

  const canPublish =
    gbpConnected && (task.status === "pending_approval" || task.status === "approved");

  return (
    <div
      className={`rounded-lg border p-4 ${
        isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/8 bg-white/[0.03]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            {action === "update_regular_hours" ? "Regular hours" : "Holiday hours"}
          </p>
          <p className={`mt-0.5 text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
            {task.title.replace(/^Step \d+: /, "")}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            task.status === "completed"
              ? "bg-[#e6f4ea] text-[#137333]"
              : task.status === "pending_approval"
                ? "bg-[#fef7e0] text-[#e37400]"
                : task.status === "rejected"
                  ? "bg-[#f1f3f4] text-[#5f6368]"
                  : "bg-[#e8f0fe] text-[#1a73e8]"
          }`}
        >
          {task.status.replace(/_/g, " ")}
        </span>
      </div>

      <p className={`mt-3 text-sm leading-relaxed ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
        {action === "update_regular_hours"
          ? "Approve to publish the regular weekly schedule below. Adjust in Google Business Profile later if your hours differ."
          : task.payload.refresh === true
            ? "Approve to merge major US holiday hours into your profile. Existing special hours for the same dates are preserved."
            : "Approve to add major US holiday hours for the year. Existing special hours for the same dates are preserved."}
      </p>

      {action === "update_regular_hours" ? (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            isLight ? "border-[#dadce0] bg-white text-[#3c4043]" : "border-white/10 bg-black/20 text-slate-200"
          }`}
        >
          {formatRegularHoursSummary(regularHours)}
        </div>
      ) : (
        <ul
          className={`mt-4 space-y-2 rounded-lg border px-3 py-3 text-sm ${
            isLight ? "border-[#dadce0] bg-white text-[#3c4043]" : "border-white/10 bg-black/20 text-slate-200"
          }`}
        >
          {holidays.map((holiday) => (
            <li key={holiday.name} className="flex items-start justify-between gap-3">
              <span className={isLight ? "text-[#202124]" : "text-white"}>{holiday.name}</span>
              <span className={`shrink-0 ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                {holiday.schedule}
              </span>
            </li>
          ))}
        </ul>
      )}

      {task.result && (
        <p className={`mt-3 text-sm ${task.status === "failed" ? "text-[#d93025]" : "text-[#137333]"}`}>
          {task.status === "failed" ? "✗" : "✓"} {task.result}
        </p>
      )}

      {canPublish && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void actions.approveAndPublish(task)}
            className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Publishing…" : "Approve & publish"}
          </button>
          {task.status === "pending_approval" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void actions.rejectTask(task.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-50 ${
                isLight ? "text-[#5f6368] hover:bg-[#f1f3f4]" : "text-slate-400 hover:bg-white/5"
              }`}
            >
              Skip
            </button>
          )}
        </div>
      )}

      {!gbpConnected && task.status === "pending_approval" && (
        <p className={`mt-3 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          Connect Google Business Profile to publish hour changes.
        </p>
      )}
    </div>
  );
}
