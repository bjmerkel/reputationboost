"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const COMMON_ACTIONS = [
  "all",
  "force_approve_task",
  "bulk_approve_tasks",
  "create_note",
  "playbook_step",
  "start_manage_as_user",
  "stop_impersonation",
  "view_page",
] as const;

export default function AuditLogFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actions, setActions] = useState<string[]>([...COMMON_ACTIONS]);

  const currentAction = searchParams.get("action") ?? "all";

  useEffect(() => {
    async function loadActions() {
      try {
        const res = await fetch("/api/admin/audit-log?distinct=actions");
        const data = await res.json();
        if (res.ok && Array.isArray(data.actions)) {
          setActions(["all", ...data.actions]);
        }
      } catch {
        // Keep defaults
      }
    }
    void loadActions();
  }, []);

  function onActionChange(action: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (action === "all") params.delete("action");
    else params.set("action", action);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `/admin/audit-log?${query}` : "/admin/audit-log");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-[#94a3b8]" htmlFor="audit-action-filter">
        Filter by action
      </label>
      <select
        id="audit-action-filter"
        value={currentAction}
        onChange={(event) => onActionChange(event.target.value)}
        className="rounded-lg border border-[#334155] bg-[#1e2433] px-3 py-2 text-sm text-white focus:border-[#6366f1] focus:outline-none"
      >
        {actions.map((action) => (
          <option key={action} value={action}>
            {action === "all" ? "All actions" : action.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}
