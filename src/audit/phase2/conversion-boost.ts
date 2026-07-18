import type { Phase1AuditPayload } from "../types";
import { detectGaps } from "./gaps";

/** Gap ids that mean the listing gets attention but weak conversion actions. */
export const CONVERSION_GAP_IDS = [
  "low-profile-conversions",
  "missing-place-action-links",
  "incomplete-place-action-links",
  "posts-without-cta",
] as const;

/** Plan steps that convert profile views into calls/directions. */
export const CONVERSION_PLAN_STEPS = [8, 11, 13, 15] as const;

const CONVERSION_GAP_ID_SET = new Set<string>(CONVERSION_GAP_IDS);

/** True when conversion gaps are present (single detector for merge, impact, candidates). */
export function auditNeedsConversionBoost(audit: Phase1AuditPayload): boolean {
  return detectGaps(audit).some((gap) => CONVERSION_GAP_ID_SET.has(gap.id));
}

/** @deprecated Prefer auditNeedsConversionBoost — same gap-based detector. */
export const profileNeedsConversionWork = auditNeedsConversionBoost;

/** Plan steps linked to rank-outside-pack gaps via gapLinksToStep. */
export const RANK_OUTSIDE_PACK_PLAN_STEPS = [3, 4, 8, 10] as const;

export function isRankOutsidePackGapId(gapId: string): boolean {
  return gapId.startsWith("rank-outside-pack");
}
