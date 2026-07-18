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

const CONVERSION_GAP_ID_SET = new Set<string>(CONVERSION_GAP_IDS);

/** True when conversion gaps are present (single detector for merge, impact, candidates). */
export function auditNeedsConversionBoost(audit: Phase1AuditPayload): boolean {
  return detectGaps(audit).some((gap) => CONVERSION_GAP_ID_SET.has(gap.id));
}

/** @deprecated Prefer auditNeedsConversionBoost — same gap-based detector. */
export const profileNeedsConversionWork = auditNeedsConversionBoost;

/**
 * True when the profile is already mostly in-pack and needs conversion work —
 * NBA should overweight engagement levers over pure rank/completeness volume.
 */
export function auditPrefersConversionOverRank(audit: Phase1AuditPayload): boolean {
  if (!auditNeedsConversionBoost(audit)) return false;
  const total = audit.rankings.totalKeywords || audit.rankings.keywords.length;
  if (total <= 0) return false;
  const packShare = audit.rankings.keywordsInPack / total;
  return packShare >= 0.5;
}
