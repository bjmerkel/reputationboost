"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const STATUSES = [
  "all",
  "pending_approval",
  "approved",
  "rejected",
  "scheduled",
  "completed",
  "failed",
] as const;

const PRIORITIES = ["all", "P0", "P1", "P2", "P3"] as const;

export default function TaskFilters({ taskTypes }: { taskTypes: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "all";
  const taskType = searchParams.get("taskType") ?? "all";
  const priority = searchParams.get("priority") ?? "all";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      params.delete("page");
      router.push(`/admin/tasks?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Status</span>
        <select
          value={status}
          onChange={(event) => updateParams({ status: event.target.value })}
          className="rounded-lg border border-[#334155] bg-[#1e2433] px-3 py-2 text-sm text-white focus:border-[#6366f1] focus:outline-none"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All statuses" : value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Type</span>
        <select
          value={taskType}
          onChange={(event) => updateParams({ taskType: event.target.value })}
          className="rounded-lg border border-[#334155] bg-[#1e2433] px-3 py-2 text-sm text-white focus:border-[#6366f1] focus:outline-none"
        >
          <option value="all">All types</option>
          {taskTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Priority</span>
        <select
          value={priority}
          onChange={(event) => updateParams({ priority: event.target.value })}
          className="rounded-lg border border-[#334155] bg-[#1e2433] px-3 py-2 text-sm text-white focus:border-[#6366f1] focus:outline-none"
        >
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All priorities" : value}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
