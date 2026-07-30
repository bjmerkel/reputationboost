"use client";

import { useMemo, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import {
  buildMonthCalendarCells,
  groupUpcomingGooglePostsByDate,
  initialCalendarMonth,
  localDateKeyFromIso,
  upcomingGooglePostTasks,
} from "@/lib/google/google-post-schedule";
import { formatPlanTimestamp } from "./plan-timestamps";

function postSnippet(task: ExecutionTask): string {
  const text = task.draftContent.trim();
  if (!text) return task.title.replace(/^Step \d+: /, "");
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export default function GooglePostScheduleCalendar({
  tasks,
  variant = "light",
  selectedDateKey,
  onSelectDate,
  onSelectTask,
}: {
  tasks: ExecutionTask[];
  variant?: "light" | "dark";
  selectedDateKey?: string | null;
  onSelectDate?: (dateKey: string) => void;
  onSelectTask?: (taskId: string) => void;
}) {
  const isLight = variant === "light";
  const [visibleMonth, setVisibleMonth] = useState(() => initialCalendarMonth(tasks));
  const grouped = useMemo(() => groupUpcomingGooglePostsByDate(tasks), [tasks]);
  const cells = buildMonthCalendarCells(visibleMonth.getFullYear(), visibleMonth.getMonth());
  const monthLabel = visibleMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
  const todayKey = localDateKeyFromIso(new Date().toISOString());
  const selectedTasks =
    selectedDateKey != null ? (grouped.get(selectedDateKey) ?? []) : [];

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() =>
            setVisibleMonth(
              new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
            )
          }
          className={`rounded-full px-2 py-1 text-sm ${
            isLight ? "text-[#5f6368] hover:bg-[#f1f3f4]" : "text-slate-400 hover:bg-white/5"
          }`}
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className={`text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() =>
            setVisibleMonth(
              new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
            )
          }
          className={`rounded-full px-2 py-1 text-sm ${
            isLight ? "text-[#5f6368] hover:bg-[#f1f3f4]" : "text-slate-400 hover:bg-white/5"
          }`}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className={isLight ? "text-[#80868b]" : "text-slate-500"}>
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell.date || !cell.dateKey) {
            return <div key={`blank-${index}`} className="min-h-12 rounded-md" />;
          }

          const dayTasks = grouped.get(cell.dateKey) ?? [];
          const isToday = cell.dateKey === todayKey;
          const isSelected = cell.dateKey === selectedDateKey;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onSelectDate?.(cell.dateKey!)}
              className={`min-h-12 rounded-md border p-1 text-left transition ${
                isSelected
                  ? isLight
                    ? "border-[#1a73e8] bg-[#e8f0fe]"
                    : "border-sky-400 bg-sky-500/10"
                  : isLight
                    ? "border-transparent hover:border-[#dadce0] hover:bg-[#f8f9fa]"
                    : "border-transparent hover:border-white/10 hover:bg-white/5"
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  isToday
                    ? isLight
                      ? "text-[#1a73e8]"
                      : "text-sky-300"
                    : isLight
                      ? "text-[#3c4043]"
                      : "text-slate-200"
                }`}
              >
                {cell.date.getDate()}
              </span>
              {dayTasks.length > 0 && (
                <span
                  className={`mt-1 block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isLight ? "bg-[#1a73e8] text-white" : "bg-sky-500 text-white"
                  }`}
                >
                  {dayTasks.length} post{dayTasks.length === 1 ? "" : "s"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDateKey && (
        <div className={`mt-3 rounded-lg border p-3 ${isLight ? "border-[#e8eaed]" : "border-white/8"}`}>
          <p className={`text-xs font-medium ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            {new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          {selectedTasks.length === 0 ? (
            <p className={`mt-2 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              No posts scheduled this day.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {selectedTasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTask?.(task.id)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                      isLight
                        ? "text-[#3c4043] hover:bg-[#f1f3f4]"
                        : "text-slate-200 hover:bg-white/5"
                    }`}
                  >
                    <span className="block">{postSnippet(task)}</span>
                    {task.scheduledFor && (
                      <span className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                        {formatPlanTimestamp(task.scheduledFor)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
