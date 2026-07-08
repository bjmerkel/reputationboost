"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import {
  createCustomEditableHolidayPeriod,
  defaultEditableHolidayPeriods,
  defaultWeekdayHours,
  findEditableHolidayDateDuplicates,
  formatEditableHolidayDateInput,
  formatEditableHolidayDateLabel,
  formatEditableHolidaySchedule,
  formatRegularHoursSummary,
  isEditableHolidayPeriodComplete,
  parseEditableHolidayDateInput,
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

function holidayRowKey(period: EditableHolidayPeriod): string {
  return period.id ?? `${period.name}-${period.month}-${period.day}`;
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
  const rowBorder = isLight ? "border-[#e8eaed]" : "border-white/8";

  if (!editable) {
    return (
      <li className={`flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0 ${rowBorder}`}>
        <span className={`min-w-0 flex-1 text-sm leading-snug ${labelClass}`}>
          {period.custom ? `${period.name || "Special hours"} · ${formatEditableHolidayDateLabel(period)}` : period.name}
        </span>
        <span className={`shrink-0 text-right text-xs leading-snug ${mutedClass}`}>
          {formatEditableHolidaySchedule(period)}
        </span>
      </li>
    );
  }

  return (
    <li
      className={`border-b py-3 last:border-b-0 ${rowBorder} ${
        period.enabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={period.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          aria-label={`Include ${period.name}`}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#dadce0]"
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium leading-snug ${labelClass}`}>{period.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${mutedClass}`}>
              <input
                type="checkbox"
                checked={period.closed}
                disabled={!period.enabled}
                onChange={(event) => onChange({ closed: event.target.checked })}
              />
              Closed
            </label>
            {!period.closed && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={period.openTime}
                  disabled={!period.enabled}
                  onChange={(event) => onChange({ openTime: event.target.value })}
                  className={inputClass}
                  aria-label={`${period.name} open time`}
                />
                <span className={`text-xs ${mutedClass}`}>to</span>
                <input
                  type="time"
                  value={period.closeTime}
                  disabled={!period.enabled}
                  onChange={(event) => onChange({ closeTime: event.target.value })}
                  className={inputClass}
                  aria-label={`${period.name} close time`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function CustomHolidayEditorRow({
  period,
  isLight,
  onChange,
  onRemove,
}: {
  period: EditableHolidayPeriod;
  isLight: boolean;
  onChange: (patch: Partial<EditableHolidayPeriod>) => void;
  onRemove: () => void;
}) {
  const labelClass = isLight ? "text-[#202124]" : "text-white";
  const mutedClass = isLight ? "text-[#5f6368]" : "text-slate-400";
  const inputClass = isLight
    ? "rounded border border-[#dadce0] bg-white px-2 py-1 text-xs text-[#3c4043]"
    : "rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-200";
  const rowBorder = isLight ? "border-[#e8eaed]" : "border-white/8";
  const incomplete = period.enabled && !isEditableHolidayPeriodComplete(period);

  return (
    <li
      className={`border-b py-3 last:border-b-0 ${rowBorder} ${
        period.enabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={period.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          aria-label="Include custom special hours"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#dadce0]"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <input
            type="text"
            value={period.name}
            disabled={!period.enabled}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Label, e.g. Staff training day"
            className={`w-full rounded border px-2 py-1.5 text-sm ${
              isLight
                ? "border-[#dadce0] bg-white text-[#202124] placeholder:text-[#9aa0a6]"
                : "border-white/10 bg-black/20 text-white placeholder:text-slate-500"
            }`}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className={`text-xs ${mutedClass}`}>
              Date
              <input
                type="date"
                value={formatEditableHolidayDateInput(period)}
                disabled={!period.enabled}
                onChange={(event) => {
                  const parsed = parseEditableHolidayDateInput(event.target.value, period.year);
                  if (parsed) onChange(parsed);
                }}
                className={`mt-1 block ${inputClass}`}
              />
            </label>
            <label className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${mutedClass}`}>
              <input
                type="checkbox"
                checked={period.closed}
                disabled={!period.enabled}
                onChange={(event) => onChange({ closed: event.target.checked })}
              />
              Closed
            </label>
            {!period.closed && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={period.openTime}
                  disabled={!period.enabled}
                  onChange={(event) => onChange({ openTime: event.target.value })}
                  className={inputClass}
                  aria-label="Custom special hours open time"
                />
                <span className={`text-xs ${mutedClass}`}>to</span>
                <input
                  type="time"
                  value={period.closeTime}
                  disabled={!period.enabled}
                  onChange={(event) => onChange({ closeTime: event.target.value })}
                  className={inputClass}
                  aria-label="Custom special hours close time"
                />
              </div>
            )}
          </div>
          {incomplete && (
            <p className={`text-xs ${isLight ? "text-[#d93025]" : "text-red-300"}`}>
              Add a label and date before publishing.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className={`shrink-0 rounded-full px-2 py-1 text-xs ${
            isLight ? "text-[#5f6368] hover:bg-[#f1f3f4]" : "text-slate-400 hover:bg-white/5"
          }`}
          aria-label="Remove custom special hours"
        >
          Remove
        </button>
      </div>
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
  const defaultHolidays = holidayEdits.filter((period) => !period.custom);
  const customHolidays = holidayEdits.filter((period) => period.custom);
  const enabledHolidayCount = holidayEdits.filter((period) => period.enabled).length;
  const duplicateDates = findEditableHolidayDateDuplicates(holidayEdits);
  const hasIncompleteCustom = customHolidays.some(
    (period) => period.enabled && !isEditableHolidayPeriodComplete(period)
  );
  const publishBlocked =
    action === "update_holiday_hours" &&
    (enabledHolidayCount === 0 || hasIncompleteCustom || duplicateDates.length > 0);

  function updateHoliday(index: number, patch: Partial<EditableHolidayPeriod>) {
    setHolidayEdits((current) =>
      current.map((period, itemIndex) => (itemIndex === index ? { ...period, ...patch } : period))
    );
  }

  function updateHolidayByKey(key: string, patch: Partial<EditableHolidayPeriod>) {
    setHolidayEdits((current) =>
      current.map((period) => (holidayRowKey(period) === key ? { ...period, ...patch } : period))
    );
  }

  function removeCustomHoliday(key: string) {
    setHolidayEdits((current) => current.filter((period) => holidayRowKey(period) !== key));
  }

  function addCustomHoliday() {
    setHolidayEdits((current) => [...current, createCustomEditableHolidayPeriod(year)]);
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

  const displayHolidays = holidayEditable ? holidayEdits : defaultEditableHolidayPeriods(year);
  const displayDefaultHolidays = displayHolidays.filter((period) => !period.custom);
  const displayCustomHolidays = displayHolidays.filter((period) => period.custom);

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
            ? "Review each holiday below, add any extra special-hour dates you need, then publish. Existing special hours for the same dates are preserved."
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
        <>
          <ul
            className={`mt-4 rounded-lg border px-3 py-1 ${
              isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-black/20"
            }`}
          >
            {(holidayEditable ? defaultHolidays : displayDefaultHolidays).map((period) => {
              const index = holidayEdits.findIndex((item) => holidayRowKey(item) === holidayRowKey(period));
              return (
                <HolidayEditorRow
                  key={holidayRowKey(period)}
                  period={period}
                  editable={holidayEditable}
                  isLight={isLight}
                  onChange={(patch) => updateHoliday(index, patch)}
                />
              );
            })}
          </ul>

          {(holidayEditable ? customHolidays.length > 0 : displayCustomHolidays.length > 0) && (
            <div className="mt-4">
              <p className={`mb-2 text-xs font-medium uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                Additional special hours
              </p>
              <ul
                className={`rounded-lg border px-3 py-1 ${
                  isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-black/20"
                }`}
              >
                {(holidayEditable ? customHolidays : displayCustomHolidays).map((period) =>
                  holidayEditable ? (
                    <CustomHolidayEditorRow
                      key={holidayRowKey(period)}
                      period={period}
                      isLight={isLight}
                      onChange={(patch) => updateHolidayByKey(holidayRowKey(period), patch)}
                      onRemove={() => removeCustomHoliday(holidayRowKey(period))}
                    />
                  ) : (
                    <HolidayEditorRow
                      key={holidayRowKey(period)}
                      period={period}
                      editable={false}
                      isLight={isLight}
                      onChange={() => undefined}
                    />
                  )
                )}
              </ul>
            </div>
          )}

          {holidayEditable && (
            <button
              type="button"
              onClick={addCustomHoliday}
              className={`mt-3 rounded-full border px-4 py-1.5 text-xs font-medium ${
                isLight
                  ? "border-[#dadce0] bg-white text-[#1a73e8] hover:bg-[#f8f9fa]"
                  : "border-white/10 bg-white/5 text-blue-300 hover:bg-white/10"
              }`}
            >
              + Add special hours
            </button>
          )}
        </>
      )}

      {action === "update_holiday_hours" && holidayEditable && (
        <div className={`mt-2 space-y-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          <p>
            {enabledHolidayCount} of {holidayEdits.length} dates selected
            {customHolidays.length > 0 ? ` (${customHolidays.length} custom)` : ""}
          </p>
          {duplicateDates.length > 0 && (
            <p className={isLight ? "text-[#d93025]" : "text-red-300"}>
              Two entries use the same date. Change or remove the duplicate before publishing.
            </p>
          )}
        </div>
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
            disabled={loading || publishBlocked}
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
