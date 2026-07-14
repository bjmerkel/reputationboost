import type { GapFlag, GbpPlanStep, Phase1AuditPayload } from "../types";
import { detectGaps } from "./gaps";
import { buildAllGbpPlanSteps } from "./gbp-plan";
import { isStepSatisfied, simulateStepDriverImpact } from "./counterfactual";
import {
  estimateStepOutcomeImpact,
  estimateStepRevenueImpact,
} from "./score-impact";

export interface PlanStepCandidate {
  stepNumber: number;
  title: string;
  satisfied: boolean;
  driverScoreImpact: number;
  outcomeScoreImpact: number;
  revenueImpact: number | null;
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
  return null;
}

function gapLinksToStep(gap: GapFlag, stepNumber: number): boolean {
  if (gap.id.startsWith("relevance-gap-") && stepNumber <= 5) return true;
  if (gap.id.startsWith("review-gap-") && (stepNumber === 10 || stepNumber === 11)) {
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
  if (gap.id.startsWith("rank-outside-pack") && [3, 4, 8, 10].includes(stepNumber)) {
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
      linkedGapIds,
      linkedKeywords,
      defaultInstruction: templateStep.instruction,
      templateStep,
    };
  });
}

/** LLM-facing summary — excludes template payloads to keep prompts smaller. */
export function summarizePlanCandidates(candidates: PlanStepCandidate[]) {
  return candidates.map((c) => ({
    stepNumber: c.stepNumber,
    title: c.title,
    satisfied: c.satisfied,
    driverScoreImpact: c.driverScoreImpact,
    outcomeScoreImpact: c.outcomeScoreImpact,
    revenueImpact: c.revenueImpact,
    linkedGapIds: c.linkedGapIds,
    linkedKeywords: c.linkedKeywords,
    defaultInstruction: c.defaultInstruction.slice(0, 280),
  }));
}
