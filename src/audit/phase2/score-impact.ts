import type { FullAuditPayload, GapFlag, ScoreComponent } from "../types";
import type { AttributionCalibration } from "./attribution-calibration";
import { calibratedStepImpact, mergeCalibrations } from "./attribution-calibration";

const STEP_BASE_IMPACT: Record<number, { visibility: number; conversion: number }> = {
  1: { visibility: 4, conversion: 1 },
  2: { visibility: 3, conversion: 1 },
  3: { visibility: 5, conversion: 2 },
  4: { visibility: 4, conversion: 1 },
  5: { visibility: 3, conversion: 1 },
  6: { visibility: 1, conversion: 4 },
  7: { visibility: 1, conversion: 3 },
  8: { visibility: 4, conversion: 2 },
  9: { visibility: 2, conversion: 3 },
  10: { visibility: 2, conversion: 5 },
  11: { visibility: 1, conversion: 6 },
  12: { visibility: 2, conversion: 2 },
  13: { visibility: 2, conversion: 2 },
  14: { visibility: 1, conversion: 3 },
  15: { visibility: 1, conversion: 3 },
  16: { visibility: 3, conversion: 2 },
};

/**
 * Estimated driver-score points if this plan step is completed.
 * Only controllable profile/relevance signals — not rank outcomes.
 */
export function estimateStepHealthImpact(
  audit: FullAuditPayload,
  stepNumber: number,
  calibration?: AttributionCalibration,
  globalCalibration?: AttributionCalibration
): number {
  const base = STEP_BASE_IMPACT[stepNumber] ?? { visibility: 2, conversion: 2 };

  let driverBoost = base.conversion;

  // Profile/relevance steps also move the driver score
  if ([1, 2, 3, 4, 5, 8].includes(stepNumber)) {
    driverBoost = Math.min(8, driverBoost + base.visibility * 0.5);
  }
  if (stepNumber === 11 && audit.reviews.unrespondedNegative > 0) {
    driverBoost = Math.min(8, driverBoost + 2);
  }
  if (stepNumber === 8 && audit.gbp.content.lastPostDate == null) {
    driverBoost = Math.min(8, driverBoost + 1);
  }

  const heuristic = Math.max(1, Math.min(8, Math.round(driverBoost)));
  const merged = mergeCalibrations(calibration, globalCalibration);
  return calibratedStepImpact(stepNumber, heuristic, merged);
}

/** Driver-only impact for gaps — rank-outcome gaps do not promise point gains. */
export function gapDriverScoreImpact(gap: GapFlag): number {
  if (gap.id.startsWith("rank-outside-pack")) return 0;
  const component = gapScoreComponent(gap);
  if (component === "visibility" || component === "revenueCapture") {
    return gap.id.startsWith("relevance-gap") ? gapScoreImpact(gap) : 0;
  }
  return gap.scoreImpact ?? gapScoreImpact(gap);
}

const CATEGORY_COMPONENT: Partial<Record<GapFlag["category"], ScoreComponent>> = {
  rankings: "visibility",
  content: "visibility",
  gbp_profile: "conversion",
  reviews: "conversion",
  disputes: "conversion",
  technical: "conversion",
  social: "visibility",
};

const PRIORITY_IMPACT: Record<GapFlag["priority"], number> = {
  P0: 8,
  P1: 5,
  P2: 3,
  P3: 1,
};

export function gapScoreComponent(gap: GapFlag): ScoreComponent {
  if (gap.id.startsWith("rank-outside-pack")) return "visibility";
  if (gap.category === "reviews" || gap.id.includes("review")) return "conversion";
  return CATEGORY_COMPONENT[gap.category] ?? "visibility";
}

export function gapScoreImpact(gap: GapFlag): number {
  const base = PRIORITY_IMPACT[gap.priority];
  if (gap.category === "rankings" || gap.id.startsWith("rank-outside-pack")) {
    return Math.min(10, base + 2);
  }
  if (gap.id === "unresponded-negative") return Math.min(10, base + 1);
  return base;
}
