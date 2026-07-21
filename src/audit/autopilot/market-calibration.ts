import type { ExecutionType } from "@/audit/types";
import type {
  AttributionCalibration,
  CalibrationConfidence,
} from "@/audit/phase2/attribution-calibration";
import {
  resolveCalibrationConfidence,
} from "@/audit/phase2/attribution-calibration";
import { uncalibratedRankPriorForStep } from "@/audit/phase2/rank-priors";
import { deriveVerticalMarketKeys } from "./market-key";

export interface MarketActionCalibration {
  marketKey: string;
  actionType: ExecutionType;
  planStepNumber: number | null;
  sampleSize: number;
  medianTargetCellRankDelta: number | null;
  medianRankImprovement: number | null;
  winRate: number;
  confidence: CalibrationConfidence;
}

export type MarketCalibrationIndex = Map<string, MarketActionCalibration>;

export interface MarketExperimentOutcome {
  marketKey: string;
  actionType: ExecutionType;
  planStepNumber: number | null;
  status: "won" | "lost" | "inconclusive";
  targetRankBefore: number | null;
  targetRankAfter: number | null;
  targetCellRankDelta: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function indexKey(marketKey: string, actionType: string): string {
  return `${marketKey}::${actionType}`;
}

export function rankImprovementFromDelta(rankDelta: number | null): number | null {
  if (rankDelta == null) return null;
  return Math.max(0, -rankDelta);
}

export function buildMarketCalibrationIndex(
  rows: MarketActionCalibration[]
): MarketCalibrationIndex {
  const index: MarketCalibrationIndex = new Map();
  for (const row of rows) {
    index.set(indexKey(row.marketKey, row.actionType), row);
  }
  return index;
}

export function buildMarketCalibrationFromExperiments(
  experiments: MarketExperimentOutcome[]
): MarketActionCalibration[] {
  const grouped = new Map<
    string,
    {
      marketKey: string;
      actionType: ExecutionType;
      planStepNumber: number | null;
      deltas: number[];
      improvements: number[];
      wins: number;
      total: number;
    }
  >();

  for (const experiment of experiments) {
    const key = indexKey(experiment.marketKey, experiment.actionType);
    const bucket = grouped.get(key) ?? {
      marketKey: experiment.marketKey,
      actionType: experiment.actionType,
      planStepNumber: experiment.planStepNumber,
      deltas: [],
      improvements: [],
      wins: 0,
      total: 0,
    };

    bucket.total += 1;
    if (experiment.status === "won") bucket.wins += 1;

    const delta =
      experiment.targetCellRankDelta ??
      (experiment.targetRankBefore != null && experiment.targetRankAfter != null
        ? experiment.targetRankAfter - experiment.targetRankBefore
        : null);
    if (delta != null) {
      bucket.deltas.push(delta);
      const improvement = rankImprovementFromDelta(delta);
      if (improvement != null) bucket.improvements.push(improvement);
    }

    grouped.set(key, bucket);
  }

  const results: MarketActionCalibration[] = [];
  for (const bucket of grouped.values()) {
    const medianTargetCellRankDelta = median(bucket.deltas);
    const medianRankImprovement = median(bucket.improvements);
    results.push({
      marketKey: bucket.marketKey,
      actionType: bucket.actionType,
      planStepNumber: bucket.planStepNumber,
      sampleSize: bucket.total,
      medianTargetCellRankDelta,
      medianRankImprovement,
      winRate: bucket.total > 0 ? bucket.wins / bucket.total : 0,
      confidence: resolveCalibrationConfidence(bucket.total),
    });
  }

  return results.sort((a, b) => b.sampleSize - a.sampleSize);
}

export function resolveMarketActionPrior(params: {
  marketKey: string;
  actionType: ExecutionType;
  planStepNumber: number;
  index: MarketCalibrationIndex;
}): {
  marketPriorRankDelta: number;
  confidence: CalibrationConfidence;
  source: "market" | "vertical" | "default";
  marketKeyUsed: string | null;
} {
  for (const candidateKey of deriveVerticalMarketKeys(params.marketKey)) {
    const entry = params.index.get(indexKey(candidateKey, params.actionType));
    if (!entry || entry.sampleSize < 1) continue;

    const prior =
      entry.medianRankImprovement ??
      rankImprovementFromDelta(entry.medianTargetCellRankDelta) ??
      0;

    if (entry.sampleSize >= 2 && prior > 0) {
      return {
        marketPriorRankDelta: prior,
        confidence: entry.confidence,
        source: candidateKey === params.marketKey ? "market" : "vertical",
        marketKeyUsed: candidateKey,
      };
    }

    if (entry.sampleSize === 1 && prior > 0) {
      const blended = prior * 0.5 + uncalibratedRankPriorForStep(params.planStepNumber) * 0.5;
      return {
        marketPriorRankDelta: blended,
        confidence: "low",
        source: candidateKey === params.marketKey ? "market" : "vertical",
        marketKeyUsed: candidateKey,
      };
    }
  }

  return {
    marketPriorRankDelta: uncalibratedRankPriorForStep(params.planStepNumber),
    confidence: "default",
    source: "default",
    marketKeyUsed: null,
  };
}

export function marketCalibrationToStepCalibration(
  rows: MarketActionCalibration[]
): AttributionCalibration {
  const byStep = new Map<number, MarketActionCalibration[]>();

  for (const row of rows) {
    if (row.planStepNumber == null) continue;
    const list = byStep.get(row.planStepNumber) ?? [];
    list.push(row);
    byStep.set(row.planStepNumber, list);
  }

  const calibration: AttributionCalibration = {};

  for (const [stepNumber, stepRows] of byStep) {
    const improvements = stepRows
      .map((row) => row.medianRankImprovement)
      .filter((value): value is number => value != null);
    const rankDeltas = stepRows
      .map((row) =>
        row.medianTargetCellRankDelta != null ? -row.medianTargetCellRankDelta : null
      )
      .filter((value): value is number => value != null);
    const sampleSize = stepRows.reduce((sum, row) => sum + row.sampleSize, 0);
    const winRate =
      stepRows.reduce((sum, row) => sum + row.winRate * row.sampleSize, 0) /
      Math.max(1, sampleSize);

    calibration[stepNumber] = {
      sampleSize,
      medianRankDelta: rankDeltas.length > 0 ? median(rankDeltas) : null,
      medianCallsDelta: 0,
      medianDirectionsDelta: 0,
      medianWebsiteClicksDelta: 0,
      estimatedScoreImpact: Math.round(
        (improvements.length > 0 ? median(improvements)! : 0) * Math.max(0.4, winRate)
      ),
      projectionSampleSize: 0,
      medianProjectedDriverImpact: null,
      medianObservedDriverImpact: null,
      medianObservedOutcomeImpact: null,
      medianObservedRevenueGain: null,
      medianProjectedRevenueGain: null,
      revenueProjectionSampleSize: 0,
      revenueProjectionScale: 1,
      confidence: resolveCalibrationConfidence(sampleSize),
    };
  }

  return calibration;
}

export function mergeMarketCalibrations(
  base: AttributionCalibration | undefined,
  market: AttributionCalibration | undefined
): AttributionCalibration | undefined {
  if (!base && !market) return undefined;
  const merged: AttributionCalibration = { ...(base ?? {}) };

  for (const [step, marketCal] of Object.entries(market ?? {})) {
    const stepNum = Number(step);
    const existing = merged[stepNum];
    if (!existing || existing.sampleSize < 2) {
      merged[stepNum] = marketCal;
      continue;
    }
    if (marketCal.sampleSize >= existing.sampleSize) {
      merged[stepNum] = {
        ...marketCal,
        medianCallsDelta: existing.medianCallsDelta,
        medianDirectionsDelta: existing.medianDirectionsDelta,
        medianWebsiteClicksDelta: existing.medianWebsiteClicksDelta,
        estimatedScoreImpact: Math.max(
          existing.estimatedScoreImpact,
          marketCal.estimatedScoreImpact
        ),
      };
    }
  }

  return merged;
}
