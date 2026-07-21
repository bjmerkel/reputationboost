"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActionAttribution } from "@/audit/types/timeseries";
import type { RankingExperiment } from "@/audit/autopilot/types";
import { formatCellDirection } from "@/audit/autopilot/leader-delta-engine";

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

function formatRank(rank: number | null | undefined): string {
  if (rank == null) return "not visible";
  if (rank > 20) return "#20+";
  return `#${rank}`;
}

export default function ExperimentResultsPanel({
  clientId,
  attributions,
}: {
  clientId: string;
  attributions: ActionAttribution[];
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

  if (loading || visible.length === 0) return null;

  return (
    <section className="rounded-xl border border-[#dadce0] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
        Ranking experiments
      </p>
      <p className="mt-1 text-sm text-[#5f6368]">
        Per-cell rank movement from autopilot tests.
      </p>

      <ul className="mt-3 space-y-3">
        {visible.map((experiment) => {
          const attribution = attributionByExperimentId.get(experiment.id);
          const rankBefore =
            attribution?.targetCellRankBefore ?? experiment.targetRankBefore;
          const rankAfter =
            attribution?.targetCellRankAfter ?? experiment.targetRankAfter;
          const cellDelta =
            attribution?.targetCellRankDelta ??
            (rankBefore != null && rankAfter != null ? rankAfter - rankBefore : null);

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

              <p className="mt-2 text-xs text-[#3c4043]">{experiment.hypothesis}</p>

              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#5f6368]">
                <span>
                  Target cell: {formatRank(rankBefore)} → {formatRank(rankAfter)}
                </span>
                {cellDelta != null && cellDelta < 0 && (
                  <span className="font-medium text-[#137333]">
                    {Math.abs(cellDelta)} position{Math.abs(cellDelta) === 1 ? "" : "s"} gained
                  </span>
                )}
              </div>

              {experiment.conclusionReason && (
                <p className="mt-1 text-xs text-[#5f6368]">{experiment.conclusionReason}</p>
              )}
              {attribution?.narrative && (
                <p className="mt-1 text-xs text-[#80868b]">{attribution.narrative}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
