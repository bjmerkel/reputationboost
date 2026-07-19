import type { GapFlag, GbpPlanStep, Phase1AuditPayload } from "../types";
import {
  auditNeedsConversionBoost,
  profileNeedsConversionWork,
} from "./conversion-boost";
import {
  CONVERSION_PLAN_STEPS,
  isRankOutsidePackGapId,
  RANK_OUTSIDE_PACK_PLAN_STEPS,
} from "./conversion-constants";
import { detectGaps } from "./gaps";
import { buildAllGbpPlanSteps } from "./gbp-plan";
import { isStepSatisfied, simulateStepDriverImpact } from "./counterfactual";
import {
  KEYWORD_PORTFOLIO_PLAN_STEP,
  portfolioStepIsSatisfied,
} from "./keyword-portfolio";
import {
  estimateStepEngagementImpact,
  estimateStepOutcomeImpact,
  estimateStepRevenueImpact,
} from "./score-impact";
import { planStepsRequiredByInventory } from "@/lib/google/gbp-field-plan-map";

export {
  auditNeedsConversionBoost,
  CONVERSION_PLAN_STEPS,
  isRankOutsidePackGapId,
  profileNeedsConversionWork,
  RANK_OUTSIDE_PACK_PLAN_STEPS,
};

export interface PlanStepCandidate {
  stepNumber: number;
  title: string;
  satisfied: boolean;
  driverScoreImpact: number;
  outcomeScoreImpact: number;
  revenueImpact: number | null;
  /** Monthly profile-action lift for conversion-family steps (not pack rank). */
  engagementImpact: number | null;
  linkedGapIds: string[];
  linkedKeywords: string[];
  defaultInstruction: string;
  templateStep: GbpPlanStep;
}

export interface PlanStepCandidateOptions {
  avgCustomerValue?: number | null;
}

function keywordFromGapId(gapId: string): string | null {
  if (gapId.startsWith("rank-outside-pack-")) {
    return gapId.replace("rank-outside-pack-", "");
  }
  if (gapId.startsWith("relevance-gap-")) {
    return gapId.replace("relevance-gap-", "");
  }
  if (gapId.startsWith("review-gap-")) {
    return gapId.replace("review-gap-", "");
  }
  if (gapId.startsWith("review-velocity-")) {
    return gapId.replace("review-velocity-", "");
  }
  return null;
}

function gapLinksToStep(gap: GapFlag, stepNumber: number): boolean {
  if (gap.id.startsWith("relevance-gap-") && stepNumber <= 5) return true;
  if (gap.id.startsWith("review-gap-") && (stepNumber === 10 || stepNumber === 11)) {
    return true;
  }
  if (gap.id.startsWith("review-velocity-") && stepNumber === 10) {
    return true;
  }
  if (gap.id === "low-photos" && stepNumber === 6) return true;
  if (gap.id === "stale-posts" && stepNumber === 8) return true;
  if (gap.id === "competitor-post-frequency" && stepNumber === 8) return true;
  if (gap.id === "posts-without-cta" && stepNumber === 8) return true;
  if (gap.id === "unresponded-negative" && stepNumber === 11) return true;
  if (gap.id === "low-response-rate" && stepNumber === 11) return true;
  if (gap.id === "missing-holiday-hours" && stepNumber === 12) return true;
  if (gap.id === "no-search-keyword-data" && [1, 3, 8].includes(stepNumber)) {
    return true;
  }
  if (
    isRankOutsidePackGapId(gap.id) &&
    (RANK_OUTSIDE_PACK_PLAN_STEPS as readonly number[]).includes(stepNumber)
  ) {
    return true;
  }
  // Views without / under-converting actions → CTA posts, trust replies, attributes/links, place actions
  if (
    (gap.id === "low-profile-conversions" || gap.id === "weak-profile-conversions") &&
    (CONVERSION_PLAN_STEPS as readonly number[]).includes(stepNumber)
  ) {
    return true;
  }
  if (
    (gap.id === "missing-place-action-links" || gap.id === "incomplete-place-action-links") &&
    stepNumber === 15
  ) {
    return true;
  }
  if (gap.id === "place-actions-api-unavailable" && stepNumber === 15) return true;
  if (
    (gap.id === "missing-pubsub-notifications" || gap.id === "incomplete-notification-types") &&
    stepNumber === 14
  ) {
    return true;
  }
  return false;
}

/** Deterministic candidate pool for LLM plan composition — includes simulated score impacts. */
export function buildPlanStepCandidates(
  audit: Phase1AuditPayload,
  options: PlanStepCandidateOptions = {}
): PlanStepCandidate[] {
  const gaps = detectGaps(audit);
  const allSteps = buildAllGbpPlanSteps(audit);

  return allSteps.map((templateStep) => {
    const satisfied = isStepSatisfied(audit, templateStep.stepNumber);
    const linkedGaps = gaps.filter((gap) => gapLinksToStep(gap, templateStep.stepNumber));
    const linkedGapIds = linkedGaps.map((gap) => gap.id);
    const linkedKeywords = [
      ...new Set(
        linkedGaps
          .map((gap) => keywordFromGapId(gap.id))
          .filter((keyword): keyword is string => keyword != null)
      ),
    ];

    return {
      stepNumber: templateStep.stepNumber,
      title: templateStep.title,
      satisfied,
      driverScoreImpact: satisfied
        ? 0
        : simulateStepDriverImpact(audit, templateStep.stepNumber),
      outcomeScoreImpact: satisfied
        ? 0
        : estimateStepOutcomeImpact(audit, templateStep.stepNumber),
      revenueImpact: satisfied
        ? null
        : estimateStepRevenueImpact(audit, templateStep.stepNumber, options.avgCustomerValue),
      engagementImpact: satisfied
        ? null
        : estimateStepEngagementImpact(audit, templateStep.stepNumber),
      linkedGapIds,
      linkedKeywords,
      defaultInstruction: templateStep.instruction,
      templateStep,
    };
  });
}

/**
 * Step numbers that merge/reconcile must keep even if the LLM (or prior plan) omitted them.
 * Same force classes as gbp-plan-merge: portfolio, rank-outside-pack, conversion, inventory.
 * Does NOT include every unsatisfied template step — that re-bloated curated plans on reconcile.
 */
export function resolveForcedPlanStepNumbers(
  audit: Phase1AuditPayload,
  candidates: PlanStepCandidate[]
): number[] {
  const forced = new Set<number>();
  const byStep = new Map(candidates.map((candidate) => [candidate.stepNumber, candidate]));

  const portfolio = byStep.get(KEYWORD_PORTFOLIO_PLAN_STEP);
  if (
    portfolio &&
    !portfolio.satisfied &&
    !portfolioStepIsSatisfied(audit)
  ) {
    forced.add(KEYWORD_PORTFOLIO_PLAN_STEP);
  }

  for (const candidate of candidates) {
    if (candidate.satisfied) continue;
    if (!candidate.linkedGapIds.some((id) => isRankOutsidePackGapId(id))) continue;
    forced.add(candidate.stepNumber);
  }

  if (auditNeedsConversionBoost(audit)) {
    for (const stepNumber of CONVERSION_PLAN_STEPS) {
      const candidate = byStep.get(stepNumber);
      if (candidate) {
        if (!candidate.satisfied) forced.add(stepNumber);
        continue;
      }
      if (!isStepSatisfied(audit, stepNumber)) forced.add(stepNumber);
    }
  }

  if (audit.gbp.locationInventory) {
    for (const stepNumber of planStepsRequiredByInventory(audit.gbp.locationInventory)) {
      forced.add(stepNumber);
    }
  }

  return [...forced].sort((a, b) => a - b);
}

/** LLM-facing summary — excludes template payloads to keep prompts smaller. */
export function summarizePlanCandidates(candidates: PlanStepCandidate[]) {
  return candidates.map((c) => ({
    stepNumber: c.stepNumber,
    title: c.title,
    satisfied: c.satisfied,
    driverScoreImpact: c.driverScoreImpact,
    outcomeScoreImpact: c.outcomeScoreImpact,
    engagementImpact: c.engagementImpact,
    revenueImpact: c.revenueImpact,
    linkedGapIds: c.linkedGapIds,
    linkedKeywords: c.linkedKeywords,
    defaultInstruction: c.defaultInstruction.slice(0, 280),
  }));
}
