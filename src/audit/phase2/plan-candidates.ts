import type { GapFlag, GbpPlanStep, Phase1AuditPayload } from "../types";
import { detectGaps } from "./gaps";
import { buildAllGbpPlanSteps } from "./gbp-plan";
import { isStepSatisfied, simulateStepDriverImpact } from "./counterfactual";

export interface PlanStepCandidate {
  stepNumber: number;
  title: string;
  satisfied: boolean;
  driverScoreImpact: number;
  linkedGapIds: string[];
  defaultInstruction: string;
  templateStep: GbpPlanStep;
}

function gapLinksToStep(gap: GapFlag, stepNumber: number): boolean {
  if (gap.id.startsWith("relevance-gap-") && stepNumber <= 5) return true;
  if (gap.id.startsWith("review-gap-") && stepNumber === 10) return true;
  if (gap.id === "low-photos" && stepNumber === 6) return true;
  if (gap.id === "stale-posts" && stepNumber === 8) return true;
  if (gap.id === "competitor-post-frequency" && stepNumber === 8) return true;
  if (gap.id === "unanswered-qa" && stepNumber === 9) return true;
  if (gap.id === "unresponded-negative" && stepNumber === 11) return true;
  if (gap.id === "low-response-rate" && stepNumber === 11) return true;
  if (gap.id === "missing-holiday-hours" && stepNumber === 12) return true;
  if (gap.id.startsWith("rank-outside-pack") && stepNumber === 16) return true;
  if (gap.id === "incomplete-prior-actions" && stepNumber === 16) return true;
  return false;
}

/** Deterministic candidate pool for LLM plan composition — includes simulated score impacts. */
export function buildPlanStepCandidates(audit: Phase1AuditPayload): PlanStepCandidate[] {
  const gaps = detectGaps(audit);
  const allSteps = buildAllGbpPlanSteps(audit);

  return allSteps.map((templateStep) => {
    const satisfied = isStepSatisfied(audit, templateStep.stepNumber);
    const linkedGapIds = gaps
      .filter((gap) => gapLinksToStep(gap, templateStep.stepNumber))
      .map((gap) => gap.id);

    return {
      stepNumber: templateStep.stepNumber,
      title: templateStep.title,
      satisfied,
      driverScoreImpact: satisfied ? 0 : simulateStepDriverImpact(audit, templateStep.stepNumber),
      linkedGapIds,
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
    linkedGapIds: c.linkedGapIds,
    defaultInstruction: c.defaultInstruction.slice(0, 280),
  }));
}
