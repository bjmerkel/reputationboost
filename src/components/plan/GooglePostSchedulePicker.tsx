"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import {
  datetimeLocalValueToIso,
  defaultGooglePostScheduleInput,
  isoToDatetimeLocalValue,
  minGooglePostScheduleTime,
  validateGooglePostScheduleTime,
} from "@/lib/google/google-post-schedule";

export default function GooglePostSchedulePicker({
  task,
  variant = "light",
  disabled = false,
  onChange,
}: {
  task: ExecutionTask;
  variant?: "light" | "dark";
  disabled?: boolean;
  onChange?: (scheduledForIso: string | null, error: string | null) => void;
}) {
  const isLight = variant === "light";
  const minLocal = useMemo(
    () => isoToDatetimeLocalValue(minGooglePostScheduleTime().toISOString()),
    []
  );
  const [localValue, setLocalValue] = useState(() => defaultGooglePostScheduleInput(task));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalValue(defaultGooglePostScheduleInput(task));
    setError(null);
  }, [task.id, task.scheduledFor, task.status, task.payload.postIndex]);

  function emit(value: string) {
    const iso = datetimeLocalValueToIso(value);
    const validationError = validateGooglePostScheduleTime(iso);
    setError(validationError);
    onChange?.(iso, validationError);
  }

  return (
    <div className="mt-3">
      <label
        className={`text-xs font-medium ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}
      >
        Publish date & time
      </label>
      <input
        type="datetime-local"
        value={localValue}
        min={minLocal}
        disabled={disabled}
        onChange={(event) => {
          const value = event.target.value;
          setLocalValue(value);
          emit(value);
        }}
        className={`mt-1 block w-full max-w-xs rounded-lg border px-3 py-2 text-sm ${
          isLight
            ? "border-[#dadce0] bg-white text-[#202124]"
            : "border-white/10 bg-slate-900 text-slate-100"
        } ${error ? "border-[#d93025]" : ""}`}
      />
      <p className={`mt-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
        Posts publish automatically — usually within 15 minutes of this time.
      </p>
      {error && (
        <p className={`mt-1 text-xs ${isLight ? "text-[#d93025]" : "text-red-300"}`}>{error}</p>
      )}
    </div>
  );
}

export function useGooglePostScheduleState(task: ExecutionTask) {
  const [scheduledForIso, setScheduledForIso] = useState<string | null>(() => {
    const initial = defaultGooglePostScheduleInput(task);
    return datetimeLocalValueToIso(initial);
  });
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    const initial = defaultGooglePostScheduleInput(task);
    const iso = datetimeLocalValueToIso(initial);
    setScheduledForIso(iso);
    setScheduleError(validateGooglePostScheduleTime(iso));
  }, [task.id, task.scheduledFor, task.status, task.payload.postIndex]);

  return {
    scheduledForIso,
    scheduleError,
    setScheduleFromPicker: (iso: string | null, error: string | null) => {
      setScheduledForIso(iso);
      setScheduleError(error);
    },
    canSchedule: scheduledForIso != null && scheduleError == null,
  };
}
