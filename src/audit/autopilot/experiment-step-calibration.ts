import type { AttributionCalibration, StepCalibration } from "@/audit/phase2/attribution-calibration";
import { resolveCalibrationConfidence } from "@/audit/phase2/attribution-calibration";
import type { RankingExperiment } from "./types";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function rankDeltaForExperiment(experiment: RankingExperiment): number | null {
  const before = experiment.targetRankBefore;
  const after = experiment.targetRankAfter;
  if (before == null || after == null) return null;
  return before - after;
}

export function buildExperimentStepCalibration(
  experiments: RankingExperiment[]
): AttributionCalibration {
  const concluded = experiments.filter((experiment) =>
    ["won", "lost", "inconclusive"].includes(experiment.status)
  );
  const byStep = new Map<number, RankingExperiment[]>();

  for (const experiment of concluded) {
    if (experiment.planStepNumber == null) continue;
    const list = byStep.get(experiment.planStepNumber) ?? [];
    list.push(experiment);
    byStep.set(experiment.planStepNumber, list);
  }

  const calibration: AttributionCalibration = {};

  for (const [stepNumber, rows] of byStep) {
    const rankDeltas = rows
      .map(rankDeltaForExperiment)
      .filter((value): value is number => value != null);
    const wins = rows.filter((row) => row.status === "won").length;
    const losses = rows.filter((row) => row.status === "lost").length;
    const winRate = rows.length > 0 ? wins / rows.length : 0;
    const medianRankDelta = rankDeltas.length > 0 ? median(rankDeltas) : null;
    const positiveRank = medianRankDelta != null && medianRankDelta > 0;
    const estimatedScoreImpact = positiveRank
      ? Math.round(Math.max(1, medianRankDelta!) * Math.max(0.5, winRate))
      : losses >= wins
        ? 0
        : 1;

    const entry: StepCalibration = {
      sampleSize: rows.length,
      medianRankDelta,
      medianCallsDelta: 0,
      medianDirectionsDelta: 0,
      medianWebsiteClicksDelta: 0,
      estimatedScoreImpact,
      projectionSampleSize: 0,
      medianProjectedDriverImpact: null,
      medianObservedDriverImpact: null,
      medianObservedOutcomeImpact: null,
      medianObservedRevenueGain: null,
      medianProjectedRevenueGain: null,
      revenueProjectionSampleSize: 0,
      revenueProjectionScale: 1,
      confidence: resolveCalibrationConfidence(rows.length),
    };
    calibration[stepNumber] = entry;
  }

  return calibration;
}

export function mergeExperimentCalibrations(
  base: AttributionCalibration | undefined,
  experiment: AttributionCalibration | undefined
): AttributionCalibration | undefined {
  if (!base && !experiment) return undefined;
  const merged: AttributionCalibration = { ...(base ?? {}) };

  for (const [step, experimentCal] of Object.entries(experiment ?? {})) {
    const stepNum = Number(step);
    const existing = merged[stepNum];
    if (!existing || existing.sampleSize < experimentCal.sampleSize) {
      merged[stepNum] = experimentCal;
      continue;
    }
    if (experimentCal.sampleSize >= 1 && experimentCal.medianRankDelta != null) {
      merged[stepNum] = {
        ...existing,
        medianRankDelta: experimentCal.medianRankDelta,
        estimatedScoreImpact: Math.max(
          existing.estimatedScoreImpact,
          experimentCal.estimatedScoreImpact
        ),
        confidence:
          experimentCal.sampleSize >= existing.sampleSize
            ? experimentCal.confidence
            : existing.confidence,
      };
    }
  }

  return merged;
}

export function winningExperimentStepsByKeyword(
  experiments: RankingExperiment[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const experiment of experiments) {
    if (experiment.status !== "won" || experiment.planStepNumber == null) continue;
    const key = experiment.keyword.toLowerCase();
    if (!map.has(key)) {
      map.set(key, experiment.planStepNumber);
    }
  }
  return map;
}
