"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import {
  defaultEditableHolidayPeriods,
  defaultWeekdayHours,
  formatEditableHolidaySchedule,
  formatRegularHoursSummary,
  parseEditableHolidayPeriods,
  type EditableHolidayPeriod,
} from "@/lib/google/gbp-hours";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";

type HoursTaskActions = Pick<PlanTaskActions, "approveAndPublish" | "rejectTask" | "loadingTaskId">;

function hoursAction(task: ExecutionTask): "update_regular_hours" | "update_holiday_hours" {
  return task.payload.hoursAction === "update_regular_hours"
    ? "update_regular_hours"
    : "update_holiday_hours";
}

function HolidayEditorRow({
  period,
  editable,
  isLight,
  onChange,
}: {
  period: EditableHolidayPeriod;
  editable: boolean;
  isLight: boolean;
  onChange: (patch: Partial<EditableHolidayPeriod>) => void;
}) {
  const labelClass = isLight ? "text-[#202124]" : "text-white";
  const mutedClass = isLight ? "text-[#5f6368]" : "text-slate-400";
  const inputClass = isLight
    ? "rounded border border-[#dadce0] bg-white px-2 py-1 text-xs text-[#3c4043]"
    : "rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-200";

  if (!editable) {
    return (
      <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
        <span className={labelClass}>{period.name}</span>
        <span className={`text-right text-xs ${mutedClass}`}>
          {formatEditableHolidaySchedule(period)}
        </span>
      </li>
    );
  }

  return (
    <li
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-md px-1 py-1 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] ${
        period.enabled ? "" : "opacity-60"
      }`}
    >
      <input
        type="checkbox"
        checked={period.enabled}
        onChange={(event) => onChange({ enabled: event.target.checked })}
        aria-label={`Include ${period.name}`}
        className="h-4 w-4 shrink-0 rounded border-[#dadce0]"
      />
      <span className={`min-w-0 text-sm ${labelClass}`}>{period.name}</span>
      <label className={`flex items-center gap-1.5 text-xs ${mutedClass}`}>
        <input
          type="checkbox"
          checked={period.closed}
          disabled={!period.enabled}
          onChange={(event) => onChange({ closed: event.target.checked })}
        />
        Closed
      </label>
      {!period.closed && (
        <>
          <input
            type="time"
            value={period.openTime}
            disabled={!period.enabled}
            onChange={(event) => onChange({ openTime: event.target.value })}
            className={inputClass}
            aria-label={`${period.name} open time`}
          />
          <input
            type="time"
            value={period.closeTime}
            disabled={!period.enabled}
            onChange={(event) => onChange({ closeTime: event.target.value })}
            className={inputClass}
            aria-label={`${period.name} close time`}
          />
        </>
      )}
    </li>
  );
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
  const regularHours = defaultWeekdayHours();

  const initialHolidayEdits = useMemo(
    () => parseEditableHolidayPeriods(task.payload.holidayEdits, year),
    [task.payload.holidayEdits, year]
  );
  const [holidayEdits, setHolidayEdits] = useState<EditableHolidayPeriod[]>(initialHolidayEdits);

  useEffect(() => {
    setHolidayEdits(parseEditableHolidayPeriods(task.payload.holidayEdits, year));
  }, [task.id, task.payload.holidayEdits, year]);

  const canPublish =
    gbpConnected && (task.status === "pending_approval" || task.status === "approved");
  const holidayEditable = action === "update_holiday_hours" && canPublish;
  const enabledHolidayCount = holidayEdits.filter((period) => period.enabled).length;

  function updateHoliday(index: number, patch: Partial<EditableHolidayPeriod>) {
    setHolidayEdits((current) =>
      current.map((period, itemIndex) => (itemIndex === index ? { ...period, ...patch } : period))
    );
  }

  async function handlePublish() {
    if (action === "update_holiday_hours") {
      await actions.approveAndPublish(task, {
        payload: {
          ...task.payload,
          holidayEdits,
        },
      });
      return;
    }

    await actions.approveAndPublish(task);
  }

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
          : holidayEditable
            ? "Review each holiday below. Uncheck any you want to skip, toggle closed days, or set open hours before publishing. Existing special hours for the same dates are preserved."
            : task.payload.refresh === true
              ? "Major US holiday hours were merged into your profile. Existing special hours for the same dates were preserved."
              : "Major US holiday hours were added for the year. Existing special hours for the same dates were preserved."}
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
          className={`mt-4 space-y-1 rounded-lg border px-3 py-3 ${
            isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-black/20"
          }`}
        >
          {(holidayEditable ? holidayEdits : defaultEditableHolidayPeriods(year)).map(
            (period, index) => (
              <HolidayEditorRow
                key={`${period.name}-${period.month}-${period.day}`}
                period={period}
                editable={holidayEditable}
                isLight={isLight}
                onChange={(patch) => updateHoliday(index, patch)}
              />
            )
          )}
        </ul>
      )}

      {action === "update_holiday_hours" && holidayEditable && (
        <p className={`mt-2 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          {enabledHolidayCount} of {holidayEdits.length} holidays selected
        </p>
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
            disabled={loading || (action === "update_holiday_hours" && enabledHolidayCount === 0)}
            onClick={() => void handlePublish()}
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
