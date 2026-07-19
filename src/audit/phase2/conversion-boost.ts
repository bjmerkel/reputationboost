import type { Phase1AuditPayload } from "../types";
import { detectGaps, WEAK_PROFILE_ACTION_RATE_PCT } from "./gaps";
import {
  CONVERSION_GAP_IDS,
  CONVERSION_PLAN_STEPS,
  isConversionPlanStep,
  isRankOutsidePackGapId,
  RANK_OUTSIDE_PACK_PLAN_STEPS,
} from "./conversion-constants";

export { WEAK_PROFILE_ACTION_RATE_PCT };
export {
  CONVERSION_GAP_IDS,
  CONVERSION_PLAN_STEPS,
  isConversionPlanStep,
  isRankOutsidePackGapId,
  RANK_OUTSIDE_PACK_PLAN_STEPS,
};
export {
  auditHasReviewVelocityGap,
  auditNeedsReviewVelocityBoost,
  auditPackShare,
} from "./review-velocity";

const CONVERSION_GAP_ID_SET = new Set<string>(CONVERSION_GAP_IDS);

/** True when conversion gaps are present (single detector for merge, impact, candidates). */
export function auditNeedsConversionBoost(audit: Phase1AuditPayload): boolean {
  return detectGaps(audit).some((gap) => CONVERSION_GAP_ID_SET.has(gap.id));
}

/**
 * True when 40–99 profile views trigger conversion gaps (P1 tier).
 * Softer than full conversion-first — mild plan/NBA boost only.
 */
export function auditNeedsSoftConversionBoost(audit: Phase1AuditPayload): boolean {
  const views = audit.gbp.performance.profileViews;
  if (views < 40 || views >= 100) return false;
  return detectGaps(audit).some(
    (gap) =>
      gap.id === "low-profile-conversions" || gap.id === "weak-profile-conversions"
  );
}

/** @deprecated Prefer auditNeedsConversionBoost — same gap-based detector. */
export const profileNeedsConversionWork = auditNeedsConversionBoost;

/**
 * True when the profile is already mostly in-pack and needs conversion work —
 * NBA should overweight engagement levers over pure rank/completeness volume.
 */
export function auditPrefersConversionOverRank(audit: Phase1AuditPayload): boolean {
  if (auditNeedsSoftConversionBoost(audit)) return false;
  if (!auditNeedsConversionBoost(audit)) return false;
  const total = audit.rankings.totalKeywords || audit.rankings.keywords.length;
  if (total <= 0) return false;
  const packShare = audit.rankings.keywordsInPack / total;
  return packShare >= 0.5;
}
