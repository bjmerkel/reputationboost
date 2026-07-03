import type { FullAuditPayload, GapFlag, ScoreComponent } from "../types";
import type { AttributionCalibration } from "./attribution-calibration";
import { calibratedStepImpact } from "./attribution-calibration";

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

function keywordsOutsidePack(audit: FullAuditPayload): string[] {
  const rankings = audit.strategy?.gbpPlan?.keywordRankings ?? audit.rankings.keywords;
  return rankings
    .filter((r) => ("inLocalPack" in r ? !r.inLocalPack : false))
    .map((r) => r.keyword);
}

/**
 * Estimated listing-strength points if this plan step is completed.
 * Weighted toward visibility (50%) and conversion (30%) to match overall formula.
 */
export function estimateStepHealthImpact(
  audit: FullAuditPayload,
  stepNumber: number,
  calibration?: AttributionCalibration
): number {
  const base = STEP_BASE_IMPACT[stepNumber] ?? { visibility: 2, conversion: 2 };
  const outsidePack = keywordsOutsidePack(audit);

  let visibilityBoost = base.visibility;
  let conversionBoost = base.conversion;

  // Steps that target rankings benefit more when keywords are outside the pack
  if ([1, 2, 3, 4, 5, 8].includes(stepNumber) && outsidePack.length > 0) {
    visibilityBoost = Math.min(8, visibilityBoost + 1);
  }
  if (stepNumber === 11 && audit.reviews.unrespondedNegative > 0) {
    conversionBoost = Math.min(8, conversionBoost + 2);
  }
  if (stepNumber === 8 && audit.gbp.content.lastPostDate == null) {
    visibilityBoost = Math.min(8, visibilityBoost + 1);
  }

  const raw = visibilityBoost * 0.5 + conversionBoost * 0.3 + (visibilityBoost + conversionBoost) * 0.1;
  const heuristic = Math.max(1, Math.min(8, Math.round(raw)));
  return calibratedStepImpact(stepNumber, heuristic, calibration);
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
