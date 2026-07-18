import type { ActionMarginalImpact, PathOptimizationBlendWeights, PathOptimizationMode, PathToHealthyOptions } from "../types";

/** Default blend when average customer value is known. */
export const BALANCED_WEIGHTS_WITH_ACV: PathOptimizationBlendWeights = {
  driver: 0.35,
  outcome: 0.35,
  revenue: 0.3,
};

/** Default blend when revenue cannot be estimated. */
export const BALANCED_WEIGHTS_WITHOUT_ACV: PathOptimizationBlendWeights = {
  driver: 0.55,
  outcome: 0.45,
  revenue: 0,
};

const DEFAULT_DRIVER_CEILING = 15;
const DEFAULT_OUTCOME_CEILING = 15;
const DEFAULT_REVENUE_CEILING = 500;

/**
 * Map monthly profile-action lift onto outcome-like points for path blending.
 * Truthful engagement signal for conversion-family steps — not pack position.
 */
export function engagementOutcomePoints(actionsGain: number): number {
  if (actionsGain <= 0) return 0;
  return Math.min(DEFAULT_OUTCOME_CEILING, Math.round(actionsGain / 2));
}

/** Rank outcome pts plus engagement-derived conversion pts (no double pack-rank claim). */
export function effectiveOutcomeGain(impact: Pick<ActionMarginalImpact, "outcomeGain" | "engagementGain">): number {
  return Math.max(0, impact.outcomeGain) + engagementOutcomePoints(impact.engagementGain ?? 0);
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function resolveBlendWeights(
  avgCustomerValue?: number | null,
  override?: PathOptimizationBlendWeights
): PathOptimizationBlendWeights {
  if (override) return override;
  return avgCustomerValue != null && avgCustomerValue > 0
    ? BALANCED_WEIGHTS_WITH_ACV
    : BALANCED_WEIGHTS_WITHOUT_ACV;
}

/** Map a raw marginal gain onto a 0–100 scale for cross-dimension blending. */
export function normalizeMarginalGain(value: number, ceiling = DEFAULT_DRIVER_CEILING): number {
  if (value <= 0) return 0;
  return clamp((value / ceiling) * 100);
}

/** Weighted composite score from normalized driver, outcome, and revenue marginals. */
export function compositeMarginalScore(
  impact: ActionMarginalImpact,
  weights: PathOptimizationBlendWeights,
  ceilings: {
    driver?: number;
    outcome?: number;
    revenue?: number;
  } = {}
): number {
  const driverNorm = normalizeMarginalGain(
    impact.driverGain,
    ceilings.driver ?? DEFAULT_DRIVER_CEILING
  );
  // Conversion-family steps keep pack-rank outcomeGain at 0; blend engagement pts instead.
  const outcomeNorm = normalizeMarginalGain(
    effectiveOutcomeGain(impact),
    ceilings.outcome ?? DEFAULT_OUTCOME_CEILING
  );
  const revenueNorm =
    impact.revenueGain != null && impact.revenueGain > 0
      ? normalizeMarginalGain(
          impact.revenueGain,
          ceilings.revenue ?? DEFAULT_REVENUE_CEILING
        )
      : 0;

  return (
    driverNorm * weights.driver +
    outcomeNorm * weights.outcome +
    revenueNorm * weights.revenue
  );
}

export function marginalScoreForMode(
  impact: ActionMarginalImpact,
  mode: PathOptimizationMode,
  weights: PathOptimizationBlendWeights
): number {
  switch (mode) {
    case "driver":
      return impact.driverGain;
    case "outcome":
      return effectiveOutcomeGain(impact);
    case "revenue":
      // Prefer $ when present; otherwise engagement actions so conversion isn't zeroed.
      return impact.revenueGain != null && impact.revenueGain > 0
        ? impact.revenueGain
        : impact.engagementGain ?? 0;
    case "balanced":
      return compositeMarginalScore(impact, weights);
    default:
      return impact.driverGain;
  }
}

/** Choose optimization mode when the caller does not specify one explicitly. */
export function resolvePathOptimizationMode(
  options: Pick<PathToHealthyOptions, "mode" | "avgCustomerValue">,
  scores: { driverScore: number; outcomeIndex: number }
): PathOptimizationMode {
  if (options.mode) return options.mode;

  const hasAcv = options.avgCustomerValue != null && options.avgCustomerValue > 0;
  if (hasAcv && scores.outcomeIndex < scores.driverScore) {
    return "revenue";
  }
  // Balanced (not driver-only) so engagement/outcome weight applies without ACV.
  return "balanced";
}
