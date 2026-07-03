"use client";

import { useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import { normalizeTextContent } from "@/lib/llm/normalize-content";

interface InlineOptimizationCardsProps {
  clientId: string;
  auditId: string;
  tasks: ExecutionTask[];
  onViewAll: () => void;
}

export default function InlineOptimizationCards({
  clientId,
  auditId,
  tasks,
  onViewAll,
}: InlineOptimizationCardsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState(tasks);

  const pending = localTasks.filter((t) => t.status === "pending_approval").slice(0, 3);

  if (pending.length === 0) return null;

  async function approve(taskId: string) {
    setLoadingId(taskId);
    try {
      const res = await fetch(`/api/execution/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) return;
      const listRes = await fetch(`/api/execution?clientId=${clientId}&auditId=${auditId}`);
      const data = await listRes.json();
      if (listRes.ok) setLocalTasks(data.tasks);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="mb-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-[#202124]">Suggested updates</h3>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-[#1a73e8] hover:underline"
        >
          View all ({localTasks.filter((t) => t.status === "pending_approval").length})
        </button>
      </div>

      {pending.map((task) => (
        <article
          key={task.id}
          className="rounded-lg border border-[#dadce0] bg-[#f8f9fa] p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#202124]">{task.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[#5f6368]">
                {normalizeTextContent(task.draftContent)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#f3e8fd] px-2 py-0.5 text-[10px] font-bold text-[#9334e6]">
              AI
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={loadingId === task.id}
              onClick={() => approve(task.id)}
              className="rounded-full bg-[#1a73e8] px-3 py-1 text-xs font-medium text-white hover:bg-[#1765cc] disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onViewAll}
              className="rounded-full border border-[#dadce0] bg-white px-3 py-1 text-xs font-medium text-[#3c4043] hover:bg-[#f1f3f4]"
            >
              Review
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
