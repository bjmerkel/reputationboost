"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export default function UserFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const grade = searchParams.get("grade") ?? "all";
  const status = searchParams.get("status") ?? "all";

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
      router.push(`/admin/users?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Search</span>
        <input
          type="search"
          defaultValue={q}
          placeholder="Email, name, or user ID"
          className="rounded-lg border border-[#334155] bg-[#1e2433] px-3 py-2 text-sm text-white placeholder:text-[#64748b] focus:border-[#6366f1] focus:outline-none"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              updateParams({ q: event.currentTarget.value });
            }
          }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Grade</span>
        <select
          value={grade}
          onChange={(event) => updateParams({ grade: event.target.value })}
          className="rounded-lg border border-[#334155] bg-[#1e2433] px-3 py-2 text-sm text-white focus:border-[#6366f1] focus:outline-none"
        >
          <option value="all">All grades</option>
          <option value="healthy">Healthy</option>
          <option value="at_risk">At risk</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Status</span>
        <select
          value={status}
          onChange={(event) => updateParams({ status: event.target.value })}
          className="rounded-lg border border-[#334155] bg-[#1e2433] px-3 py-2 text-sm text-white focus:border-[#6366f1] focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="at_risk">At risk</option>
          <option value="churning">Churning</option>
          <option value="never_onboarded">Not onboarded</option>
          <option value="signed_up">Signed up only</option>
        </select>
      </label>
    </div>
  );
}
