import type { ActionAttribution } from "../types/timeseries";
import { positionVisibilityScore } from "./scoring";
import { uncalibratedRankPriorForStep } from "./rank-priors";

export type CalibrationConfidence = "high" | "medium" | "low" | "default";

export interface StepCalibration {
  sampleSize: number;
  medianRankDelta: number | null;
  medianCallsDelta: number;
  /** Median observed directions delta in the attribution window. */
  medianDirectionsDelta: number;
  /** Median observed website-click delta in the attribution window. */
  medianWebsiteClicksDelta: number;
  estimatedScoreImpact: number;
  projectionSampleSize: number;
  medianProjectedDriverImpact: number | null;
  medianObservedDriverImpact: number | null;
  medianObservedOutcomeImpact: number | null;
  medianObservedRevenueGain: number | null;
  medianProjectedRevenueGain: number | null;
  revenueProjectionSampleSize: number;
  revenueProjectionScale: number;
  confidence: CalibrationConfidence;
}

/** Heuristic view→action rates used by conversion-family counterfactuals. */
export interface EngagementGainRates {
  calls: number;
  directions: number;
  websiteClicks: number;
}

export type AttributionCalibration = Record<number, StepCalibration>;

export interface GapCalibration {
  sampleSize: number;
  medianRankDelta: number | null;
  medianObservedRevenueGain: number | null;
  confidence: CalibrationConfidence;
}

export type GapAttributionCalibration = Record<string, GapCalibration>;

const STEP_FROM_ACTION_ITEM = /^gbp-step-(\d+)$/;
const MAX_DRIVER_IMPACT = 15;
const MAX_REVENUE_SCALE = 1.5;
const MIN_REVENUE_SCALE = 0.5;

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

export function resolveCalibrationConfidence(sampleSize: number): CalibrationConfidence {
  if (sampleSize >= 5) return "high";
  if (sampleSize >= 2) return "medium";
  if (sampleSize === 1) return "low";
  return "default";
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

function revenueProjectionStats(rows: ActionAttribution[]): {
  revenueProjectionSampleSize: number;
  medianProjectedRevenueGain: number | null;
  medianObservedRevenueGain: number | null;
  revenueProjectionScale: number;
} {
  const projected = rows
    .map((row) => row.projectedRevenueGain)
    .filter((value): value is number => value != null && value > 0);
  const observed = rows
    .map((row) => row.estimatedRevenue)
    .filter((value): value is number => value != null && value > 0);

  let revenueProjectionScale = 1;
  if (projected.length >= 2 && observed.length >= 2) {
    const projectedMedian = median(projected);
    const observedMedian = median(observed);
    if (projectedMedian > 0) {
      revenueProjectionScale = Math.max(
        MIN_REVENUE_SCALE,
        Math.min(MAX_REVENUE_SCALE, observedMedian / projectedMedian)
      );
    }
  }

  return {
    revenueProjectionSampleSize: Math.min(projected.length, observed.length),
    medianProjectedRevenueGain: projected.length > 0 ? Math.round(median(projected)) : null,
    medianObservedRevenueGain: observed.length > 0 ? Math.round(median(observed)) : null,
    revenueProjectionScale,
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
  return Math.max(MIN_REVENUE_SCALE, Math.min(MAX_REVENUE_SCALE, ratio));
}

/** Scale projected revenue when historical revenue projections diverge from observed gains. */
export function projectionRevenueScaleForStep(
  stepNumber: number,
  calibration?: AttributionCalibration
): number {
  const cal = calibration?.[stepNumber];
  if (!cal || cal.revenueProjectionSampleSize < 2) return 1;
  return cal.revenueProjectionScale;
}

/** Average revenue projection scale across plan steps referenced by actions. */
export function averageRevenueScaleForActions(
  actions: Array<{ source: "plan" | "gap"; id: string }>,
  calibration?: AttributionCalibration
): number {
  const scales: number[] = [];
  for (const action of actions) {
    const match = action.id.match(/^gbp-step-(\d+)$/);
    if (!match) continue;
    scales.push(projectionRevenueScaleForStep(Number(match[1]), calibration));
  }
  if (scales.length === 0) return 1;
  return scales.reduce((sum, value) => sum + value, 0) / scales.length;
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
    const revenueProjection = revenueProjectionStats(rows);
    const rankDeltas: number[] = [];
    const callsDeltas: number[] = [];
    const directionsDeltas: number[] = [];
    const websiteClicksDeltas: number[] = [];
    const outcomeImpacts: number[] = [];

    for (const row of rows) {
      if (row.rankBefore != null && row.rankAfter != null) {
        rankDeltas.push(row.rankBefore - row.rankAfter);
        outcomeImpacts.push(rankDeltaToVisibilityImpact(row.rankBefore, row.rankAfter));
      }
      if (row.callsDelta != null) callsDeltas.push(row.callsDelta);
      if (row.directionsDelta != null) directionsDeltas.push(row.directionsDelta);
      if (row.websiteClicksDelta != null) websiteClicksDeltas.push(row.websiteClicksDelta);
      if (row.projectedOutcomeImpact != null) {
        outcomeImpacts.push(row.projectedOutcomeImpact);
      }
    }

    calibration[stepNumber] = {
      sampleSize: rows.length,
      medianRankDelta: rankDeltas.length > 0 ? median(rankDeltas) : null,
      medianCallsDelta: callsDeltas.length > 0 ? median(callsDeltas) : 0,
      medianDirectionsDelta: directionsDeltas.length > 0 ? median(directionsDeltas) : 0,
      medianWebsiteClicksDelta:
        websiteClicksDeltas.length > 0 ? median(websiteClicksDeltas) : 0,
      estimatedScoreImpact: resolveEstimatedScoreImpact(rankImpact, projection),
      projectionSampleSize: projection.projectionSampleSize,
      medianProjectedDriverImpact: projection.medianProjectedDriverImpact,
      medianObservedDriverImpact: projection.medianObservedDriverImpact,
      medianObservedOutcomeImpact:
        outcomeImpacts.length > 0 ? clampImpact(median(outcomeImpacts)) : null,
      medianObservedRevenueGain: revenueProjection.medianObservedRevenueGain,
      medianProjectedRevenueGain: revenueProjection.medianProjectedRevenueGain,
      revenueProjectionSampleSize: revenueProjection.revenueProjectionSampleSize,
      revenueProjectionScale: revenueProjection.revenueProjectionScale,
      confidence: resolveCalibrationConfidence(rows.length),
    };
  }

  return calibration;
}

/** Per-keyword calibration for rank-outside-pack gap counterfactuals. */
export function buildGapAttributionCalibration(
  attributions: ActionAttribution[]
): GapAttributionCalibration {
  const byKeyword = new Map<string, ActionAttribution[]>();

  for (const row of attributions) {
    if (row.preliminary || !row.primaryKeyword) continue;
    const key = row.primaryKeyword.toLowerCase();
    const list = byKeyword.get(key) ?? [];
    list.push(row);
    byKeyword.set(key, list);
  }

  const calibration: GapAttributionCalibration = {};

  for (const [keyword, rows] of byKeyword) {
    const rankDeltas = rows
      .filter((row) => row.rankBefore != null && row.rankAfter != null)
      .map((row) => row.rankBefore! - row.rankAfter!);
    const revenues = rows
      .map((row) => row.estimatedRevenue)
      .filter((value): value is number => value != null && value > 0);

    const gapId = `rank-outside-pack-${keyword}`;
    const entry: GapCalibration = {
      sampleSize: rows.length,
      medianRankDelta: rankDeltas.length > 0 ? median(rankDeltas) : null,
      medianObservedRevenueGain: revenues.length > 0 ? Math.round(median(revenues)) : null,
      confidence: resolveCalibrationConfidence(rows.length),
    };

    calibration[gapId] = entry;
    calibration[keyword] = entry;
  }

  return calibration;
}

/** Uncalibrated fallback when no step-specific prior exists (legacy alias). */
export const DEFAULT_UNCALIBRATED_RANK_DELTA = 1;

function calibratedRankDeltaFromMedian(
  medianRankDelta: number | null,
  sampleSize: number
): number | null {
  if (medianRankDelta == null) return null;
  if (medianRankDelta <= 0) return 0;
  const cap = sampleSize >= 5 ? 5 : 3;
  return Math.min(cap, Math.max(1, Math.round(medianRankDelta)));
}

/** Calibrated rank lift for a plan step counterfactual. */
export function rankDeltaForStep(
  stepNumber: number,
  calibration?: AttributionCalibration
): number {
  const cal = calibration?.[stepNumber];
  if (cal?.sampleSize != null && cal.sampleSize >= 2) {
    const calibrated = calibratedRankDeltaFromMedian(cal.medianRankDelta, cal.sampleSize);
    if (calibrated != null) return calibrated;

    // Engagement-only evidence with no rank movement observed.
    if (
      cal.medianCallsDelta <= 0 &&
      cal.medianDirectionsDelta <= 0 &&
      cal.medianWebsiteClicksDelta <= 0
    ) {
      return 0;
    }
    // Positive engagement but no rank signal — fall back to the step prior.
    return uncalibratedRankPriorForStep(stepNumber);
  }

  return uncalibratedRankPriorForStep(stepNumber);
}

/** Calibrated rank lift for a rank-outside-pack gap counterfactual. */
export function rankDeltaForGap(
  gapId: string,
  currentRank: number,
  gapCalibration?: GapAttributionCalibration
): number {
  const keyword = gapId.replace("rank-outside-pack-", "").toLowerCase();
  const gapCal = gapCalibration?.[gapId] ?? gapCalibration?.[keyword];
  if (gapCal && gapCal.sampleSize >= 2 && gapCal.medianRankDelta != null) {
    const calibrated = calibratedRankDeltaFromMedian(
      gapCal.medianRankDelta,
      gapCal.sampleSize
    );
    if (calibrated != null) return calibrated;
  } else if (gapCal && gapCal.medianRankDelta != null && gapCal.medianRankDelta > 0) {
    return Math.min(5, Math.max(1, Math.round(gapCal.medianRankDelta)));
  }
  return Math.max(3, currentRank - 3);
}

/**
 * Demote plan steps with observed zero/negative attribution when sample ≥ 2.
 * Returns a multiplier applied to planStepImpactScore.
 */
export function negativeEvidencePenalty(
  stepNumber: number,
  calibration?: AttributionCalibration
): number {
  const cal = calibration?.[stepNumber];
  if (!cal || cal.sampleSize < 2) return 1;

  const hasNegativeRank =
    cal.medianRankDelta != null && cal.medianRankDelta <= 0;
  const hasZeroEngagement =
    cal.medianCallsDelta <= 0 &&
    cal.medianDirectionsDelta <= 0 &&
    cal.medianWebsiteClicksDelta <= 0;

  if (hasNegativeRank || hasZeroEngagement) return 0.3;
  return 1;
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

/** Apply revenue projection scaling to a raw counterfactual revenue gain. */
export function calibratedRevenueGain(
  rawGain: number,
  actions: Array<{ source: "plan" | "gap"; id: string }>,
  calibration?: AttributionCalibration
): number {
  if (rawGain <= 0) return 0;
  const scale = averageRevenueScaleForActions(actions, calibration);
  return Math.max(0, Math.round(rawGain * scale));
}

const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 14;

/**
 * Blend heuristic view→action rates with observed attribution deltas.
 * Observed window deltas are annualized to a monthly rate vs profile views.
 * Clamped to 0.5×–1.5× the heuristic channel when the heuristic is non-zero.
 */
export function blendEngagementRates(
  heuristic: EngagementGainRates,
  stepNumber: number,
  views: number,
  calibration?: AttributionCalibration,
  windowDays = DEFAULT_ATTRIBUTION_WINDOW_DAYS
): EngagementGainRates {
  const cal = calibration?.[stepNumber];
  if (!cal || cal.sampleSize < 2) return heuristic;

  const monthlyFactor = 30 / Math.max(1, windowDays);
  const denom = Math.max(views, 100);
  const observed: EngagementGainRates = {
    calls: Math.max(0, cal.medianCallsDelta * monthlyFactor) / denom,
    directions: Math.max(0, cal.medianDirectionsDelta * monthlyFactor) / denom,
    websiteClicks: Math.max(0, cal.medianWebsiteClicksDelta * monthlyFactor) / denom,
  };

  const weight = cal.sampleSize >= 5 ? 0.7 : 0.5;

  if (observed.calls + observed.directions + observed.websiteClicks <= 0) {
    // Observed zero engagement: dampen toward zero instead of reverting to heuristic.
    const dampenChannel = (heuristicRate: number): number => {
      if (heuristicRate <= 0) return 0;
      const dampened = heuristicRate * (1 - weight);
      return Math.max(heuristicRate * MIN_REVENUE_SCALE, dampened);
    };

    return {
      calls: dampenChannel(heuristic.calls),
      directions: dampenChannel(heuristic.directions),
      websiteClicks: dampenChannel(heuristic.websiteClicks),
    };
  }

  const blendChannel = (heuristicRate: number, observedRate: number): number => {
    const mixed = heuristicRate * (1 - weight) + observedRate * weight;
    if (heuristicRate <= 0) {
      // Don't invent a huge new channel from noise when the heuristic is zero.
      return Math.max(0, Math.min(0.05, mixed));
    }
    return Math.max(
      heuristicRate * MIN_REVENUE_SCALE,
      Math.min(heuristicRate * MAX_REVENUE_SCALE, mixed)
    );
  };

  return {
    calls: blendChannel(heuristic.calls, observed.calls),
    directions: blendChannel(heuristic.directions, observed.directions),
    websiteClicks: blendChannel(heuristic.websiteClicks, observed.websiteClicks),
  };
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
      medianCallsDelta: cal.medianCallsDelta ?? globalCal.medianCallsDelta,
      medianDirectionsDelta: cal.medianDirectionsDelta ?? globalCal.medianDirectionsDelta,
      medianWebsiteClicksDelta:
        cal.medianWebsiteClicksDelta ?? globalCal.medianWebsiteClicksDelta,
      projectionSampleSize: cal.projectionSampleSize + globalCal.projectionSampleSize,
      medianProjectedDriverImpact:
        cal.medianProjectedDriverImpact ?? globalCal.medianProjectedDriverImpact,
      medianObservedDriverImpact:
        cal.medianObservedDriverImpact ?? globalCal.medianObservedDriverImpact,
      medianObservedOutcomeImpact:
        cal.medianObservedOutcomeImpact ?? globalCal.medianObservedOutcomeImpact,
      medianObservedRevenueGain:
        cal.medianObservedRevenueGain ?? globalCal.medianObservedRevenueGain,
      medianProjectedRevenueGain:
        cal.medianProjectedRevenueGain ?? globalCal.medianProjectedRevenueGain,
      revenueProjectionSampleSize:
        cal.revenueProjectionSampleSize + globalCal.revenueProjectionSampleSize,
      revenueProjectionScale:
        cal.revenueProjectionSampleSize >= 2
          ? cal.revenueProjectionScale
          : globalCal.revenueProjectionScale,
      estimatedScoreImpact: clampImpact(
        cal.estimatedScoreImpact * 0.7 + globalCal.estimatedScoreImpact * 0.3
      ),
      confidence: resolveCalibrationConfidence(cal.sampleSize + globalCal.sampleSize),
    };
  }

  return merged;
}
