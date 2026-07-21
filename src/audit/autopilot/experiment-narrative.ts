import type { ActionAttribution } from "@/audit/types/timeseries";
import type { RankingExperiment } from "./types";
import { formatCellDirection } from "./leader-delta-engine";

function formatRank(rank: number | null | undefined): string {
  if (rank == null) return "not visible";
  if (rank > 20) return "#20+";
  return `#${rank}`;
}

export interface ExperimentResultSummary {
  wins: number;
  losses: number;
  inconclusive: number;
  measuring: number;
}

export function summarizeExperimentOutcomes(
  experiments: RankingExperiment[]
): ExperimentResultSummary {
  const summary: ExperimentResultSummary = {
    wins: 0,
    losses: 0,
    inconclusive: 0,
    measuring: 0,
  };
  for (const experiment of experiments) {
    if (experiment.status === "won") summary.wins += 1;
    else if (experiment.status === "lost") summary.losses += 1;
    else if (experiment.status === "inconclusive") summary.inconclusive += 1;
    else if (experiment.status === "measuring") summary.measuring += 1;
  }
  return summary;
}

export function buildExperimentPeriodSummary(
  experiments: RankingExperiment[]
): string | null {
  const summary = summarizeExperimentOutcomes(experiments);
  const total = summary.wins + summary.losses + summary.inconclusive;
  if (total === 0 && summary.measuring === 0) return null;

  const parts: string[] = [];
  if (summary.wins > 0) {
    parts.push(`${summary.wins} cell win${summary.wins === 1 ? "" : "s"}`);
  }
  if (summary.losses > 0) {
    parts.push(`${summary.losses} no-movement`);
  }
  if (summary.inconclusive > 0) {
    parts.push(`${summary.inconclusive} inconclusive`);
  }
  if (summary.measuring > 0) {
    parts.push(`${summary.measuring} measuring`);
  }
  return parts.join(" · ");
}

export function buildExperimentResultNarrative(params: {
  experiment: RankingExperiment;
  attribution?: ActionAttribution | null;
}): string {
  const { experiment, attribution } = params;
  const location = formatCellDirection(experiment.gridNorth, experiment.gridEast);
  const rankBefore =
    attribution?.targetCellRankBefore ?? experiment.targetRankBefore;
  const rankAfter =
    attribution?.targetCellRankAfter ?? experiment.targetRankAfter;

  const parts = [
    `Tested “${experiment.keyword}” ${location} against ${experiment.leaderName}.`,
    experiment.hypothesis,
  ];

  if (rankBefore !== rankAfter) {
    parts.push(
      `Target cell moved ${formatRank(rankBefore)} → ${formatRank(rankAfter)}.`
    );
  } else if (experiment.status === "measuring") {
    parts.push("Measuring rank movement in the target cell.");
  }

  if (experiment.conclusionReason) {
    parts.push(experiment.conclusionReason);
  } else if (experiment.banditMetadata?.explorationReason) {
    parts.push(experiment.banditMetadata.explorationReason);
  }

  if (experiment.status === "won" && experiment.planStepNumber != null) {
    parts.push(`Plan step ${experiment.planStepNumber} is prioritized based on this win.`);
  }

  return parts.filter(Boolean).join(" ");
}

export function buildExperimentNextStepHint(
  experiment: RankingExperiment
): string | null {
  if (experiment.status === "won") {
    return "Repeat this action type on other weak cells from your portfolio.";
  }
  if (experiment.status === "lost" || experiment.status === "inconclusive") {
    return "Try the next ranked action for this cell or move to a higher-priority neighborhood.";
  }
  if (experiment.status === "measuring") {
    return "We will conclude this test after the attribution window and update your plan order.";
  }
  return null;
}
