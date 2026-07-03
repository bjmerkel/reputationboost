import type { FullAuditPayload, GapFlag, Phase1AuditPayload, ScoreComponent } from "../types";
import type { AttributionCalibration } from "./attribution-calibration";
import { calibratedStepImpact, mergeCalibrations } from "./attribution-calibration";
import { simulateGapDriverImpact, simulateStepDriverImpact } from "./counterfactual";

/**
 * Estimated driver-score points if this plan step is completed.
 * Derived from counterfactual re-runs of computeHealthScores(), optionally
 * blended with attribution calibration when enough outcome data exists.
 */
export function estimateStepHealthImpact(
  audit: FullAuditPayload,
  stepNumber: number,
  calibration?: AttributionCalibration,
  globalCalibration?: AttributionCalibration
): number {
  const simulated = simulateStepDriverImpact(audit, stepNumber);
  const merged = mergeCalibrations(calibration, globalCalibration);
  return calibratedStepImpact(stepNumber, simulated, merged);
}

/** Driver-only impact for gaps — rank-outcome gaps do not promise point gains. */
export function gapDriverScoreImpact(gap: GapFlag, audit?: Phase1AuditPayload): number {
  if (gap.id.startsWith("rank-outside-pack")) return 0;
  if (audit) {
    return simulateGapDriverImpact(audit, gap);
  }
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
