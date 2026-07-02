"use client";

import { useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import { normalizeTextContent } from "@/lib/llm/normalize-content";

interface ExecutionQueueProps {
  clientId: string;
  auditId: string;
  initialTasks: ExecutionTask[];
  contentSource?: "llm" | "template";
}

const statusColors: Record<ExecutionTask["status"], string> = {
  pending_approval: "bg-amber-500/20 text-amber-300",
  approved: "bg-blue-500/20 text-blue-300",
  rejected: "bg-slate-500/20 text-slate-400",
  scheduled: "bg-cyan-500/20 text-cyan-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  failed: "bg-red-500/20 text-red-300",
};

const typeLabels: Record<ExecutionTask["type"], string> = {
  google_post: "Google Post",
  gbp_description: "GBP Description",
  gbp_services: "GBP Photos & Services",
  review_response: "Review Response",
  review_request: "Review Request",
  qa_answer: "Q&A Answer",
  schema_markup: "Schema Markup",
  citation_fix: "Citation Fix",
  social_post: "Social Post",
};

export default function ExecutionQueue({
  clientId,
  auditId,
  initialTasks,
  contentSource,
}: ExecutionQueueProps) {
  const [tasks, setTasks] = useState<ExecutionTask[]>(initialTasks);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/execution?clientId=${clientId}&auditId=${auditId}`);
    const data = await res.json();
    if (res.ok) setTasks(data.tasks);
  }

  async function approve(taskId: string) {
    setLoadingId(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/execution/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Approve failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function reject(taskId: string) {
    setLoadingId(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/execution/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Reject failed");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function runTask(taskId: string) {
    setLoadingId(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/execution/${taskId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Execute failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execute failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function approveAll() {
    const pending = tasks.filter((t) => t.status === "pending_approval");
    for (const task of pending) {
      await approve(task.id);
    }
  }

  async function runAllApproved() {
    const approved = tasks.filter((t) => t.status === "approved");
    for (const task of approved) {
      await runTask(task.id);
    }
  }

  const pending = tasks.filter((t) => t.status === "pending_approval").length;
  const approved = tasks.filter((t) => t.status === "approved").length;
  const completed = tasks.filter((t) => t.status === "completed").length;

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-slate-400">
        No execution tasks yet. Run a full audit to generate the action queue.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Phase 3 — Execution Queue
          </span>
          <p className="mt-1 text-sm text-slate-400">
            {pending} pending · {approved} approved · {completed} completed
            {contentSource === "llm" && (
              <span className="ml-2 text-violet-400">· AI-generated copy</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pending > 0 && (
            <button
              type="button"
              onClick={approveAll}
              className="btn-secondary rounded-full px-4 py-2 text-xs font-semibold text-white"
            >
              Approve All ({pending})
            </button>
          )}
          {approved > 0 && (
            <button
              type="button"
              onClick={runAllApproved}
              className="btn-primary rounded-full px-4 py-2 text-xs font-semibold text-white"
            >
              Run Approved ({approved})
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                  {typeLabels[task.type]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[task.status]}`}
                >
                  {task.status.replace("_", " ")}
                </span>
                <span className="text-xs font-bold text-slate-500">{task.priority}</span>
              </div>

              <div className="flex gap-2">
                {task.status === "pending_approval" && (
                  <>
                    <button
                      type="button"
                      disabled={loadingId === task.id}
                      onClick={() => approve(task.id)}
                      className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={loadingId === task.id}
                      onClick={() => reject(task.id)}
                      className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 hover:bg-white/10 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
                {task.status === "approved" && (
                  <button
                    type="button"
                    disabled={loadingId === task.id}
                    onClick={() => runTask(task.id)}
                    className="btn-primary rounded-full px-4 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {loadingId === task.id ? "Running…" : "Execute"}
                  </button>
                )}
              </div>
            </div>

            <p className="mt-3 font-medium text-white">{task.title}</p>
            <p className="mt-2 rounded-lg bg-white/5 p-3 text-sm leading-relaxed text-slate-300">
              {normalizeTextContent(task.draftContent)}
            </p>

            {task.result && (
              <p className="mt-2 text-sm text-emerald-400">✓ {task.result}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
