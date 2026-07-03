import type { ActionAttribution } from "../types/timeseries";
import { positionVisibilityScore } from "./scoring";

export interface StepCalibration {
  sampleSize: number;
  medianRankDelta: number | null;
  medianCallsDelta: number;
  estimatedScoreImpact: number;
}

export type AttributionCalibration = Record<number, StepCalibration>;

const STEP_FROM_ACTION_ITEM = /^gbp-step-(\d+)$/;

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

/**
 * Derive per-step score impact estimates from historical action attributions.
 * Used to calibrate heuristic step impacts when enough outcome data exists.
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
    const overallImpact = Math.max(
      1,
      Math.min(8, Math.round(visImpact * 0.5 + (median(callsDeltas) > 0 ? 1 : 0)))
    );

    calibration[stepNumber] = {
      sampleSize: rows.length,
      medianRankDelta: rankDeltas.length > 0 ? median(rankDeltas) : null,
      medianCallsDelta: callsDeltas.length > 0 ? median(callsDeltas) : 0,
      estimatedScoreImpact: overallImpact,
    };
  }

  return calibration;
}

export function calibratedStepImpact(
  stepNumber: number,
  heuristicImpact: number,
  calibration?: AttributionCalibration
): number {
  const cal = calibration?.[stepNumber];
  if (!cal || cal.sampleSize < 2) return heuristicImpact;
  const weight = cal.sampleSize >= 10 ? 0.75 : 0.65;
  return Math.max(
    1,
    Math.min(8, Math.round(heuristicImpact * (1 - weight) + cal.estimatedScoreImpact * weight))
  );
}

/** Prefer business-specific calibration; fall back to global cross-customer data. */
export function mergeCalibrations(
  business?: AttributionCalibration,
  global?: AttributionCalibration
): AttributionCalibration | undefined {
  if (!business && !global) return undefined;

  const merged: AttributionCalibration = { ...global };
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
      estimatedScoreImpact: Math.round(
        cal.estimatedScoreImpact * 0.7 + globalCal.estimatedScoreImpact * 0.3
      ),
    };
  }
  return merged;
}
