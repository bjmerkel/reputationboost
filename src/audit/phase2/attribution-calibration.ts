import type { ActionAttribution } from "../types/timeseries";
import { positionVisibilityScore } from "./scoring";

export interface StepCalibration {
  sampleSize: number;
  medianRankDelta: number | null;
  medianCallsDelta: number;
  estimatedScoreImpact: number;
  projectionSampleSize: number;
  medianProjectedDriverImpact: number | null;
  medianObservedDriverImpact: number | null;
}

export type AttributionCalibration = Record<number, StepCalibration>;

const STEP_FROM_ACTION_ITEM = /^gbp-step-(\d+)$/;
const MAX_DRIVER_IMPACT = 15;

function rankDeltaToVisibilityImpact(rankBefore: number, rankAfter: number): number {
  const before = positionVisibilityScore(rankBefore);
  const after = positionVisibilityScore(rankAfter);
  return Math.max(0, after - before);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clampImpact(value: number): number {
  return Math.max(0, Math.min(MAX_DRIVER_IMPACT, Math.round(value)));
}

function rankBasedImpact(rows: ActionAttribution[]): number {
  const rankDeltas: number[] = [];
  const visibilityImpacts: number[] = [];
  const callsDeltas: number[] = [];

  for (const row of rows) {
    if (row.rankBefore != null && row.rankAfter != null) {
      rankDeltas.push(row.rankBefore - row.rankAfter);
      visibilityImpacts.push(rankDeltaToVisibilityImpact(row.rankBefore, row.rankAfter));
    }
    if (row.callsDelta != null) callsDeltas.push(row.callsDelta);
  }

  const visImpact = visibilityImpacts.length > 0 ? median(visibilityImpacts) : 0;
  return clampImpact(visImpact * 0.5 + (median(callsDeltas) > 0 ? 1 : 0));
}

function projectionStats(rows: ActionAttribution[]): {
  projectionSampleSize: number;
  medianProjectedDriverImpact: number | null;
  medianObservedDriverImpact: number | null;
} {
  const projected = rows
    .map((row) => row.projectedDriverImpact)
    .filter((value): value is number => value != null);
  const observed = rows
    .map((row) => row.observedDriverImpact)
    .filter((value): value is number => value != null);

  return {
    projectionSampleSize: observed.length,
    medianProjectedDriverImpact: projected.length > 0 ? clampImpact(median(projected)) : null,
    medianObservedDriverImpact: observed.length > 0 ? clampImpact(median(observed)) : null,
  };
}

function resolveEstimatedScoreImpact(
  rankImpact: number,
  projection: ReturnType<typeof projectionStats>
): number {
  const { projectionSampleSize, medianObservedDriverImpact } = projection;

  if (medianObservedDriverImpact != null && projectionSampleSize >= 2) {
    return clampImpact(medianObservedDriverImpact * 0.8 + rankImpact * 0.2);
  }

  if (medianObservedDriverImpact != null && projectionSampleSize === 1) {
    return clampImpact(medianObservedDriverImpact * 0.55 + rankImpact * 0.45);
  }

  return Math.max(1, rankImpact || 1);
}

/**
 * Scale factor to correct simulated impacts when historical projections overshoot/undershoot.
 * Clamped to 0.5–1.5 so a single outlier cannot collapse predictions.
 */
export function projectionScaleForStep(
  stepNumber: number,
  calibration?: AttributionCalibration
): number {
  const cal = calibration?.[stepNumber];
  if (!cal || cal.projectionSampleSize < 3) return 1;
  if (cal.medianProjectedDriverImpact == null || cal.medianObservedDriverImpact == null) {
    return 1;
  }
  if (cal.medianProjectedDriverImpact <= 0) return 1;

  const ratio = cal.medianObservedDriverImpact / cal.medianProjectedDriverImpact;
  return Math.max(0.5, Math.min(1.5, ratio));
}

/**
 * Derive per-step score impact estimates from historical action attributions.
 * Prefers observed driver-score deltas when projection tracking data exists.
 */
export function buildAttributionCalibration(
  attributions: ActionAttribution[]
): AttributionCalibration {
  const byStep = new Map<number, ActionAttribution[]>();

  for (const attr of attributions) {
    if (attr.preliminary) continue;
    const match = attr.actionItemId?.match(STEP_FROM_ACTION_ITEM);
    if (!match) continue;
    const stepNumber = Number(match[1]);
    const list = byStep.get(stepNumber) ?? [];
    list.push(attr);
    byStep.set(stepNumber, list);
  }

  const calibration: AttributionCalibration = {};

  for (const [stepNumber, rows] of byStep) {
    const rankImpact = rankBasedImpact(rows);
    const projection = projectionStats(rows);
    const rankDeltas: number[] = [];
    const callsDeltas: number[] = [];

    for (const row of rows) {
      if (row.rankBefore != null && row.rankAfter != null) {
        rankDeltas.push(row.rankBefore - row.rankAfter);
      }
      if (row.callsDelta != null) callsDeltas.push(row.callsDelta);
    }

    calibration[stepNumber] = {
      sampleSize: rows.length,
      medianRankDelta: rankDeltas.length > 0 ? median(rankDeltas) : null,
      medianCallsDelta: callsDeltas.length > 0 ? median(callsDeltas) : 0,
      estimatedScoreImpact: resolveEstimatedScoreImpact(rankImpact, projection),
      projectionSampleSize: projection.projectionSampleSize,
      medianProjectedDriverImpact: projection.medianProjectedDriverImpact,
      medianObservedDriverImpact: projection.medianObservedDriverImpact,
    };
  }

  return calibration;
}

export function calibratedStepImpact(
  stepNumber: number,
  simulatedImpact: number,
  calibration?: AttributionCalibration
): number {
  const scaled = Math.round(simulatedImpact * projectionScaleForStep(stepNumber, calibration));
  const cal = calibration?.[stepNumber];
  if (!cal || cal.sampleSize < 2) return Math.max(0, scaled);

  const weight =
    cal.projectionSampleSize >= 5 ? 0.8 : cal.projectionSampleSize >= 2 ? 0.7 : 0.65;

  return clampImpact(scaled * (1 - weight) + cal.estimatedScoreImpact * weight);
}

/** Prefer business-specific calibration; fall back to global cross-customer data. */
export function mergeCalibrations(
  business?: AttributionCalibration,
  global?: AttributionCalibration
): AttributionCalibration | undefined {
  if (!business && !global) return undefined;

  const merged: AttributionCalibration = {};

  for (const [step, cal] of Object.entries(global ?? {})) {
    merged[Number(step)] = { ...cal };
  }

  for (const [step, cal] of Object.entries(business ?? {})) {
    const stepNum = Number(step);
    const globalCal = global?.[stepNum];
    if (!cal || cal.sampleSize < 2) continue;

    if (!globalCal || globalCal.sampleSize < 5) {
      merged[stepNum] = cal;
      continue;
    }

    merged[stepNum] = {
      sampleSize: cal.sampleSize + globalCal.sampleSize,
      medianRankDelta: cal.medianRankDelta ?? globalCal.medianRankDelta,
      medianCallsDelta: cal.medianCallsDelta || globalCal.medianCallsDelta,
      projectionSampleSize: cal.projectionSampleSize + globalCal.projectionSampleSize,
      medianProjectedDriverImpact:
        cal.medianProjectedDriverImpact ?? globalCal.medianProjectedDriverImpact,
      medianObservedDriverImpact:
        cal.medianObservedDriverImpact ?? globalCal.medianObservedDriverImpact,
      estimatedScoreImpact: clampImpact(
        cal.estimatedScoreImpact * 0.7 + globalCal.estimatedScoreImpact * 0.3
      ),
    };
  }

  return merged;
}
