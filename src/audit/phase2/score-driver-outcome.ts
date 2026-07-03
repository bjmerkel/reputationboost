/** Headline blend: driver (controllable profile) vs outcome (rank results). */
export const DRIVER_OUTCOME_BLEND = {
  driver: 0.7,
  outcome: 0.3,
} as const;

/** Outcome index sub-blend within rank-derived components. */
export const OUTCOME_INDEX_WEIGHTS = {
  visibility: 0.6,
  revenueCapture: 0.4,
} as const;

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Rank-derived outcome index from visibility + revenue capture. */
export function computeOutcomeIndex(visibility: number, revenueCapture: number): number {
  return clamp(
    visibility * OUTCOME_INDEX_WEIGHTS.visibility +
      revenueCapture * OUTCOME_INDEX_WEIGHTS.revenueCapture
  );
}

/** Headline listing strength from driver + outcome layers. */
export function computeOverallFromDriverOutcome(
  driverScore: number,
  outcomeIndex: number
): number {
  return clamp(
    driverScore * DRIVER_OUTCOME_BLEND.driver +
      outcomeIndex * DRIVER_OUTCOME_BLEND.outcome
  );
}
