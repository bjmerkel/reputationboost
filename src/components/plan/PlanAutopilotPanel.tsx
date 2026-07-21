"use client";

import { useCallback, useEffect, useState } from "react";
import type { RankingExperiment } from "@/audit/autopilot/types";
import { formatCellDirection } from "@/audit/autopilot/leader-delta-engine";
import { planScrollElementId } from "@/lib/google/gbp-field-plan-links";

const STATUS_LABELS: Record<RankingExperiment["status"], string> = {
  proposed: "Proposed",
  pending_approval: "Needs approval",
  running: "Approved",
  measuring: "Measuring",
  won: "Won",
  lost: "No movement",
  inconclusive: "Inconclusive",
  cancelled: "Cancelled",
};

export default function PlanAutopilotPanel({
  clientId,
  variant = "light",
  onOpenTask,
}: {
  clientId: string;
  variant?: "light" | "dark";
  onOpenTask?: (taskId: string, stepNumber?: number | null) => void;
}) {
  const isLight = variant === "light";
  const [experiments, setExperiments] = useState<RankingExperiment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/autopilot/experiments?clientId=${encodeURIComponent(clientId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { experiments?: RankingExperiment[] };
      setExperiments(data.experiments ?? []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = experiments.filter((exp) =>
    ["pending_approval", "running", "measuring"].includes(exp.status)
  );
  const recent = experiments.filter((exp) =>
    ["won", "lost", "inconclusive"].includes(exp.status)
  );

  if (loading) return null;
  if (experiments.length === 0) return null;

  return (
    <section
      className={`rounded-xl border p-4 ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-slate-900"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          isLight ? "text-[#80868b]" : "text-slate-500"
        }`}
      >
        Ranking autopilot
      </p>
      <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Per-cell experiments run through your approval queue and measure grid movement.
      </p>

      {active.length > 0 && (
        <ul className="mt-3 space-y-2">
          {active.map((experiment) => (
            <li
              key={experiment.id}
              className={`rounded-lg border px-3 py-3 ${
                isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                    {experiment.keyword}
                  </p>
                  <p className={`mt-0.5 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                    {formatCellDirection(experiment.gridNorth, experiment.gridEast)} · beat{" "}
                    {experiment.leaderName}
                  </p>
                  <p className={`mt-1 text-xs ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
                    {experiment.hypothesis}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    experiment.status === "measuring"
                      ? isLight
                        ? "bg-[#e8f0fe] text-[#1a73e8]"
                        : "bg-sky-400/15 text-sky-300"
                      : isLight
                        ? "bg-[#fef7e0] text-[#b06000]"
                        : "bg-amber-400/15 text-amber-300"
                  }`}
                >
                  {STATUS_LABELS[experiment.status]}
                </span>
              </div>
              {experiment.executionTaskId && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenTask?.(experiment.executionTaskId!, experiment.planStepNumber);
                    if (experiment.planStepNumber != null) {
                      document
                        .getElementById(planScrollElementId(experiment.planStepNumber))
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className={`mt-2 text-xs font-semibold ${
                    isLight ? "text-[#1a73e8]" : "text-sky-300"
                  }`}
                >
                  Open approval task →
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <div className="mt-4">
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isLight ? "text-[#80868b]" : "text-slate-500"
            }`}
          >
            Recent results
          </p>
          <ul className="mt-2 space-y-1.5">
            {recent.slice(0, 3).map((experiment) => (
              <li
                key={experiment.id}
                className={`text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}
              >
                <span className={`font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                  {experiment.keyword}
                </span>{" "}
                · {STATUS_LABELS[experiment.status]}
                {experiment.conclusionReason ? ` — ${experiment.conclusionReason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
