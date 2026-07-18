/** Gap ids that mean the listing gets attention but weak conversion actions. */
export const CONVERSION_GAP_IDS = [
  "low-profile-conversions",
  "weak-profile-conversions",
  "missing-place-action-links",
  "incomplete-place-action-links",
  "posts-without-cta",
] as const;

/** Plan steps that convert profile views into calls/directions. */
export const CONVERSION_PLAN_STEPS = [8, 11, 13, 15] as const;

/** Plan steps linked to rank-outside-pack gaps via gapLinksToStep. */
export const RANK_OUTSIDE_PACK_PLAN_STEPS = [3, 4, 8, 10] as const;

const CONVERSION_PLAN_STEP_SET = new Set<number>(CONVERSION_PLAN_STEPS);

export function isConversionPlanStep(stepNumber: number): boolean {
  return CONVERSION_PLAN_STEP_SET.has(stepNumber);
}

export function isRankOutsidePackGapId(gapId: string): boolean {
  return gapId.startsWith("rank-outside-pack");
}
