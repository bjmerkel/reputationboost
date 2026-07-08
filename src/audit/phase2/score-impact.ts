import type { FullAuditPayload, GapFlag, Phase1AuditPayload, ScoreComponent } from "../types";
import type { AttributionCalibration } from "./attribution-calibration";
import { calibratedStepImpact, mergeCalibrations } from "./attribution-calibration";
import {
  projectOutcomeScoresFromActions,
  simulateActionMarginalImpact,
  simulateGapDriverImpact,
  simulateStepDriverImpact,
} from "./counterfactual";
import { compositeMarginalScore, resolveBlendWeights } from "./path-optimization";

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

function gapActionRef(gap: GapFlag) {
  return { source: "gap" as const, id: gap.id };
}

/** Outcome-index points if this gap were closed (rank gaps use rank counterfactuals). */
export function gapOutcomeScoreImpact(gap: GapFlag, audit: Phase1AuditPayload): number {
  if (
    gap.id.startsWith("rank-outside-pack") ||
    gap.id.startsWith("pack-fragility-") ||
    gap.id === "no-search-keyword-data" ||
    gap.id.startsWith("relevance-gap-")
  ) {
    const projection = projectOutcomeScoresFromActions(audit, [gapActionRef(gap)]);
    return Math.max(0, projection.outcomeGain);
  }
  return 0;
}

/** Estimated monthly revenue gain if this gap were closed. */
export function gapRevenueImpact(
  gap: GapFlag,
  audit: Phase1AuditPayload,
  avgCustomerValue?: number | null
): number | null {
  if (avgCustomerValue == null || avgCustomerValue <= 0) return null;
  const projection = projectOutcomeScoresFromActions(audit, [gapActionRef(gap)], {
    avgCustomerValue,
  });
  return projection.revenueGain;
}

/** Whether a gap should appear in the path candidate pool. */
export function gapQualifiesForPool(
  gap: GapFlag,
  audit: Phase1AuditPayload,
  avgCustomerValue?: number | null
): boolean {
  const driver = gapDriverScoreImpact(gap, audit);
  const outcome = gapOutcomeScoreImpact(gap, audit);
  const revenue = gapRevenueImpact(gap, audit, avgCustomerValue) ?? 0;
  return driver > 0 || outcome > 0 || revenue > 0;
}

/** Composite sort score for greedy path candidate ordering. */
export function gapCandidateSortScore(
  gap: GapFlag,
  audit: Phase1AuditPayload,
  avgCustomerValue?: number | null,
  blendWeights?: import("../types").PathOptimizationBlendWeights
): number {
  const impact = simulateActionMarginalImpact(audit, [], gapActionRef(gap), {
    avgCustomerValue,
  });
  return compositeMarginalScore(
    impact,
    resolveBlendWeights(avgCustomerValue, blendWeights)
  );
}

/** Plan step outcome-index gain if completed in isolation. */
export function estimateStepOutcomeImpact(audit: Phase1AuditPayload, stepNumber: number): number {
  const projection = projectOutcomeScoresFromActions(audit, [
    { source: "plan", id: `gbp-step-${stepNumber}` },
  ]);
  return Math.max(0, projection.outcomeGain);
}

/** Plan step estimated monthly revenue gain if completed in isolation. */
export function estimateStepRevenueImpact(
  audit: Phase1AuditPayload,
  stepNumber: number,
  avgCustomerValue?: number | null
): number | null {
  if (avgCustomerValue == null || avgCustomerValue <= 0) return null;
  const projection = projectOutcomeScoresFromActions(
    audit,
    [{ source: "plan", id: `gbp-step-${stepNumber}` }],
    { avgCustomerValue }
  );
  return projection.revenueGain;
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
