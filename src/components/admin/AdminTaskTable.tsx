"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatRelativeDate } from "@/components/admin/AdminBadges";
import type { AdminTaskListItem } from "@/lib/admin/types";

function statusClass(status: string): string {
  if (status === "pending_approval") return "text-amber-400";
  if (status === "completed") return "text-emerald-400";
  if (status === "failed") return "text-red-400";
  return "text-[#cbd5e1]";
}

export default function AdminTaskTable({
  tasks,
  canWrite,
}: {
  tasks: AdminTaskListItem[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approvableIds = useMemo(
    () =>
      new Set(
        tasks
          .filter((task) => task.status === "pending_approval" || task.status === "rejected")
          .map((task) => task.id)
      ),
    [tasks]
  );

  const selectedApprovable = [...selected].filter((id) => approvableIds.has(id));

  function toggleOne(taskId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedApprovable.length === approvableIds.size && approvableIds.size > 0) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(approvableIds));
  }

  async function approveOne(taskId: string) {
    setLoadingId(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to approve task");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve task");
    } finally {
      setLoadingId(null);
    }
  }

  async function approveSelected() {
    if (selectedApprovable.length === 0) return;
    setBulkLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", taskIds: selectedApprovable }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Bulk approve failed");
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk approve failed");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <>
      {canWrite && approvableIds.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d3348] px-4 py-3">
          <p className="text-sm text-[#94a3b8]">
            {selectedApprovable.length} of {approvableIds.size} approvable selected
          </p>
          <button
            type="button"
            onClick={approveSelected}
            disabled={bulkLoading || selectedApprovable.length === 0}
            className="rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkLoading ? "Approving…" : `Approve selected (${selectedApprovable.length})`}
          </button>
        </div>
      ) : null}

      {error ? <p className="px-4 py-2 text-sm text-red-400">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#1a1f2e] text-[#64748b]">
            <tr>
              {canWrite ? (
                <th className="px-4 py-3 font-medium">
                  <input
                    type="checkbox"
                    checked={approvableIds.size > 0 && selectedApprovable.length === approvableIds.size}
                    onChange={toggleAll}
                    disabled={approvableIds.size === 0}
                    aria-label="Select all approvable tasks"
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Business</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              {canWrite ? <th className="px-4 py-3 font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td
                  colSpan={canWrite ? 9 : 7}
                  className="px-4 py-10 text-center text-[#64748b]"
                >
                  No tasks match these filters.
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const canApprove = approvableIds.has(task.id);
                return (
                  <tr key={task.id} className="border-t border-[#2d3348]/60 hover:bg-[#1a1f2e]/60">
                    {canWrite ? (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(task.id)}
                          onChange={() => toggleOne(task.id)}
                          disabled={!canApprove}
                          aria-label={`Select ${task.title}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{task.title}</p>
                      {task.result ? (
                        <p className="mt-1 max-w-xs truncate text-xs text-red-400">{task.result}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${task.userId}`}
                        className="text-[#cbd5e1] hover:text-[#a5b4fc]"
                      >
                        {task.userName || task.userEmail || task.userId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/businesses/${task.businessId}`}
                        className="text-[#94a3b8] hover:text-[#a5b4fc]"
                      >
                        {task.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8]">{task.taskType}</td>
                    <td className="px-4 py-3 text-[#cbd5e1]">{task.priority}</td>
                    <td className={`px-4 py-3 font-medium ${statusClass(task.status)}`}>
                      {task.status.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{formatRelativeDate(task.createdAt)}</td>
                    {canWrite ? (
                      <td className="px-4 py-3">
                        {canApprove ? (
                          <button
                            type="button"
                            onClick={() => approveOne(task.id)}
                            disabled={loadingId === task.id || bulkLoading}
                            className="text-sm text-[#818cf8] hover:text-[#a5b4fc] disabled:opacity-50"
                          >
                            {loadingId === task.id ? "Approving…" : "Approve"}
                          </button>
                        ) : (
                          <span className="text-[#64748b]">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
