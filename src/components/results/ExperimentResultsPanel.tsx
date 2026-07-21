"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActionAttribution } from "@/audit/types/timeseries";
import type { RankingExperiment } from "@/audit/autopilot/types";
import { formatCellDirection } from "@/audit/autopilot/leader-delta-engine";
import {
  buildExperimentNextStepHint,
  buildExperimentPeriodSummary,
  buildExperimentResultNarrative,
} from "@/audit/autopilot/experiment-narrative";
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

export default function ExperimentResultsPanel({
  clientId,
  attributions,
  onFocusStep,
}: {
  clientId: string;
  attributions: ActionAttribution[];
  onFocusStep?: (stepNumber: number) => void;
}) {
  const [experiments, setExperiments] = useState<RankingExperiment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/autopilot/experiments?clientId=${encodeURIComponent(clientId)}`
      );
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

  const attributionByExperimentId = useMemo(() => {
    const map = new Map<string, ActionAttribution>();
    for (const attr of attributions) {
      if (attr.experimentId) map.set(attr.experimentId, attr);
    }
    return map;
  }, [attributions]);

  const visible = experiments.filter((exp) =>
    ["measuring", "won", "lost", "inconclusive"].includes(exp.status)
  );
  const periodSummary = buildExperimentPeriodSummary(experiments);

  if (loading || visible.length === 0) return null;

  return (
    <section className="rounded-xl border border-[#dadce0] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
        Ranking experiments
      </p>
      <p className="mt-1 text-sm text-[#5f6368]">
        Per-cell rank movement from beat-the-leader tests.
      </p>
      {periodSummary && (
        <p className="mt-2 text-xs font-medium text-[#1a73e8]">{periodSummary}</p>
      )}

      <ul className="mt-3 space-y-3">
        {visible.map((experiment) => {
          const attribution = attributionByExperimentId.get(experiment.id);
          const narrative = buildExperimentResultNarrative({ experiment, attribution });
          const nextStep = buildExperimentNextStepHint(experiment);

          return (
            <li
              key={experiment.id}
              className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#202124]">
                    {experiment.keyword}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5f6368]">
                    {formatCellDirection(experiment.gridNorth, experiment.gridEast)} · vs{" "}
                    {experiment.leaderName}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    experiment.status === "won"
                      ? "bg-[#e6f4ea] text-[#137333]"
                      : experiment.status === "measuring"
                        ? "bg-[#e8f0fe] text-[#1a73e8]"
                        : "bg-[#f1f3f4] text-[#5f6368]"
                  }`}
                >
                  {STATUS_LABELS[experiment.status]}
                </span>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-[#3c4043]">{narrative}</p>

              {nextStep && (
                <p className="mt-2 text-xs text-[#1a73e8]">Next: {nextStep}</p>
              )}

              {experiment.planStepNumber != null && onFocusStep && (
                <button
                  type="button"
                  onClick={() => {
                    onFocusStep(experiment.planStepNumber!);
                    document
                      .getElementById(planScrollElementId(experiment.planStepNumber!))
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="mt-2 text-xs font-semibold text-[#1a73e8]"
                >
                  Open plan step {experiment.planStepNumber} →
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
