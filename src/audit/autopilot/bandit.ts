import type { ExecutionType } from "@/audit/types";
import type { LeaderDeltaAction } from "./types";
import type { MarketCalibrationIndex } from "./market-calibration";
import { resolveMarketActionPrior } from "./market-calibration";
import type { AutopilotMode } from "./modes";

export interface BusinessArmStats {
  actionType: ExecutionType;
  wins: number;
  losses: number;
  inconclusive: number;
}

export interface BanditAlternative {
  actionType: ExecutionType;
  planStepNumber: number;
  score: number;
  rank: number;
  ucbBonus: number;
  meanReward: number;
}

export interface BanditSelection {
  action: LeaderDeltaAction;
  actionIndex: number;
  ucbScore: number;
  explorationReason: string;
  alternatives: BanditAlternative[];
}

function armKey(actionType: ExecutionType): string {
  return actionType;
}

function buildArmStatsMap(stats: BusinessArmStats[]): Map<string, BusinessArmStats> {
  const map = new Map<string, BusinessArmStats>();
  for (const row of stats) {
    map.set(armKey(row.actionType), row);
  }
  return map;
}

function meanRewardForArm(params: {
  action: LeaderDeltaAction;
  marketKey: string;
  marketIndex: MarketCalibrationIndex;
  businessStats: BusinessArmStats | undefined;
}): { mean: number; priorWeight: number } {
  const marketPrior = resolveMarketActionPrior({
    marketKey: params.marketKey,
    actionType: params.action.actionType,
    planStepNumber: params.action.planStepNumber,
    index: params.marketIndex,
  });

  const marketWinRate =
    marketPrior.source === "default"
      ? Math.min(0.55, Math.max(0.2, params.action.marketPriorRankDelta / 6))
      : Math.min(0.9, Math.max(0.1, params.action.marketPriorRankDelta / 5));

  const priorWeight =
    marketPrior.source === "default" ? 1 : marketPrior.confidence === "high" ? 4 : 2;

  const stats = params.businessStats;
  const businessWins = stats?.wins ?? 0;
  const businessLosses = stats?.losses ?? 0;
  const businessTrials = businessWins + businessLosses;

  const totalReward = marketWinRate * priorWeight + businessWins;
  const totalTrials = priorWeight + businessTrials;

  return {
    mean: totalTrials > 0 ? totalReward / totalTrials : marketWinRate,
    priorWeight: totalTrials,
  };
}

export function selectActionWithBandit(params: {
  actions: LeaderDeltaAction[];
  marketKey: string;
  marketIndex: MarketCalibrationIndex;
  businessStats?: BusinessArmStats[];
  mode?: AutopilotMode;
  actionIndex?: number;
}): BanditSelection | null {
  if (params.actions.length === 0) return null;

  if (params.actionIndex != null) {
    const action = params.actions[params.actionIndex];
    if (!action) return null;
    return {
      action,
      actionIndex: params.actionIndex,
      ucbScore: action.marketPriorRankDelta / action.effort,
      explorationReason: "Manual arm override",
      alternatives: params.actions.map((candidate, index) => ({
        actionType: candidate.actionType,
        planStepNumber: candidate.planStepNumber,
        score: candidate.marketPriorRankDelta / candidate.effort,
        rank: index + 1,
        ucbBonus: 0,
        meanReward: candidate.marketPriorRankDelta,
      })),
    };
  }

  if (params.mode === "manual") {
    const action = params.actions[0]!;
    return {
      action,
      actionIndex: 0,
      ucbScore: action.marketPriorRankDelta / action.effort,
      explorationReason: "Greedy market-prior ranking",
      alternatives: params.actions.slice(0, 3).map((candidate, index) => ({
        actionType: candidate.actionType,
        planStepNumber: candidate.planStepNumber,
        score: candidate.marketPriorRankDelta / candidate.effort,
        rank: index + 1,
        ucbBonus: 0,
        meanReward: candidate.marketPriorRankDelta,
      })),
    };
  }

  const statsMap = buildArmStatsMap(params.businessStats ?? []);
  const totalPulls = [...statsMap.values()].reduce(
    (sum, row) => sum + row.wins + row.losses + row.inconclusive,
    0
  );

  const scored = params.actions.map((action, index) => {
    const { mean, priorWeight } = meanRewardForArm({
      action,
      marketKey: params.marketKey,
      marketIndex: params.marketIndex,
      businessStats: statsMap.get(armKey(action.actionType)),
    });
    const trials = Math.max(1, priorWeight);
    const ucbBonus = Math.sqrt((2 * Math.log(totalPulls + 2)) / trials);
    const effortAdjusted = (mean + ucbBonus) / action.effort;
    return {
      action,
      index,
      mean,
      ucbBonus,
      effortAdjusted,
    };
  });

  scored.sort((a, b) => b.effortAdjusted - a.effortAdjusted);
  const winner = scored[0]!;
  const runnerUp = scored[1];

  const explorationReason =
    runnerUp && winner.ucbBonus > runnerUp.ucbBonus * 0.8
      ? "Exploring under-tested action with strong market prior"
      : winner.mean >= (runnerUp?.mean ?? 0)
        ? "Best observed win rate in this market"
        : "Exploring alternative after recent losses";

  return {
    action: winner.action,
    actionIndex: winner.index,
    ucbScore: winner.effortAdjusted,
    explorationReason,
    alternatives: scored.slice(0, 4).map((row, rank) => ({
      actionType: row.action.actionType,
      planStepNumber: row.action.planStepNumber,
      score: row.effortAdjusted,
      rank: rank + 1,
      ucbBonus: row.ucbBonus,
      meanReward: row.mean,
    })),
  };
}

export function buildBusinessArmStatsFromExperiments(
  experiments: Array<{
    actionType: ExecutionType;
    status: "won" | "lost" | "inconclusive";
  }>
): BusinessArmStats[] {
  const grouped = new Map<string, BusinessArmStats>();

  for (const experiment of experiments) {
    const key = armKey(experiment.actionType);
    const bucket = grouped.get(key) ?? {
      actionType: experiment.actionType,
      wins: 0,
      losses: 0,
      inconclusive: 0,
    };
    if (experiment.status === "won") bucket.wins += 1;
    else if (experiment.status === "lost") bucket.losses += 1;
    else bucket.inconclusive += 1;
    grouped.set(key, bucket);
  }

  return [...grouped.values()];
}
