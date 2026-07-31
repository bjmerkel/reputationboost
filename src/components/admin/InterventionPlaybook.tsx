"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ViewAsUserButton from "@/components/admin/ViewAsUserButton";
import { INTERVENTION_PLAYBOOK } from "@/lib/admin/playbook";

export default function InterventionPlaybook({
  userId,
  pendingTasks,
  canWrite,
}: {
  userId: string;
  pendingTasks: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  if (!canWrite) return null;

  async function completeStep(stepId: string, withNote?: string) {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/outreach/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId, note: withNote }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to log step");
      }

      setCompletedSteps((prev) => new Set(prev).add(stepId));
      setActiveStep(null);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
      <h2 className="text-lg font-semibold text-white">Intervention playbook</h2>
      <p className="mt-1 text-sm text-[#94a3b8]">
        Guided workflow for at-risk user outreach. Each step is logged to the audit trail.
      </p>

      <ol className="mt-6 space-y-4">
        {INTERVENTION_PLAYBOOK.map((step, index) => {
          const done = completedSteps.has(step.id);
          const isActive = activeStep === step.id;

          return (
            <li
              key={step.id}
              className={`rounded-lg border px-4 py-4 ${
                done ? "border-emerald-500/30 bg-emerald-500/5" : "border-[#2d3348] bg-[#1a1f2e]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done ? "bg-emerald-500/20 text-emerald-300" : "bg-[#2d3348] text-[#94a3b8]"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{step.title}</p>
                  <p className="mt-1 text-sm text-[#94a3b8]">{step.description}</p>

                  {step.id === "resolve_blockers" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ViewAsUserButton userId={userId} label="Manage as user" />
                      {pendingTasks > 0 ? (
                        <a
                          href={`/admin/tasks?userId=${userId}&status=pending_approval`}
                          className="inline-flex rounded-lg border border-[#334155] px-3 py-1.5 text-sm text-[#cbd5e1] hover:bg-[#1e2433]"
                        >
                          Review {pendingTasks} pending tasks →
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => completeStep(step.id)}
                        disabled={saving}
                        className="rounded-lg border border-[#334155] px-3 py-1.5 text-sm text-[#cbd5e1] hover:bg-[#1e2433] disabled:opacity-50"
                      >
                        Mark complete
                      </button>
                    </div>
                  ) : step.id === "review_signals" ? (
                    <button
                      type="button"
                      onClick={() => completeStep(step.id)}
                      disabled={saving || done}
                      className="mt-3 rounded-lg border border-[#334155] px-3 py-1.5 text-sm text-[#cbd5e1] hover:bg-[#1e2433] disabled:opacity-50"
                    >
                      {done ? "Reviewed" : "Mark reviewed"}
                    </button>
                  ) : isActive ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={3}
                        placeholder={step.noteTemplate ?? "Add a note…"}
                        className="w-full rounded-lg border border-[#334155] bg-[#1e2433] px-3 py-2 text-sm text-white placeholder:text-[#64748b] focus:border-[#6366f1] focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => completeStep(step.id, note || step.noteTemplate)}
                          disabled={saving}
                          className="rounded-lg bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#4f46e5] disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save & complete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveStep(null);
                            setNote("");
                          }}
                          className="rounded-lg border border-[#334155] px-3 py-1.5 text-sm text-[#94a3b8]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStep(step.id);
                        setNote(step.noteTemplate ?? "");
                      }}
                      disabled={saving || done}
                      className="mt-3 rounded-lg border border-[#334155] px-3 py-1.5 text-sm text-[#cbd5e1] hover:bg-[#1e2433] disabled:opacity-50"
                    >
                      {done ? "Completed" : "Start step"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
