/**
 * Evidence-based uncalibrated rank-lift priors by GBP plan step.
 * Calibrated attributions override these when sample size ≥ 2.
 */

/** Category and service coverage steps can influence relevance/pack fit. */
const RELEVANCE_RANK_PRIORS: Record<number, number> = {
  1: 2, // Primary category
  2: 2, // Secondary categories
  3: 1, // Description
  4: 1, // Service sections
  5: 1, // Priority keyword services
};

/** Reputation prominence without a guaranteed pack jump. */
const REPUTATION_RANK_PRIORS: Record<number, number> = {
  10: 1, // Request reviews
};

/** Portfolio rotation can unlock demand-aligned terms. */
const PORTFOLIO_RANK_PRIOR = 1;

/** Returns the modeled rank-position lift before calibration evidence exists. */
export function uncalibratedRankPriorForStep(stepNumber: number): number {
  if (stepNumber in RELEVANCE_RANK_PRIORS) {
    return RELEVANCE_RANK_PRIORS[stepNumber]!;
  }
  if (stepNumber in REPUTATION_RANK_PRIORS) {
    return REPUTATION_RANK_PRIORS[stepNumber]!;
  }
  if (stepNumber === 17) {
    return PORTFOLIO_RANK_PRIOR;
  }
  // Media, posts, disputes, hours, attributes, place actions, alerts: no rank claim.
  return 0;
}

/** Whether a plan step has a credible modeled rank effect when uncalibrated. */
export function stepClaimsRankImprovement(stepNumber: number): boolean {
  return uncalibratedRankPriorForStep(stepNumber) > 0;
}

/** Gaps where rank reflects demand/proximity limits rather than profile gaps. */
export function isProximityOrDemandLimitedRankGap(gapId: string): boolean {
  return gapId.startsWith("rank-without-demand-");
}
