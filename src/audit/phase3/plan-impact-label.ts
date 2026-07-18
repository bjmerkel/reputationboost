import type { PlanStep } from "../types";
import { formatCurrency } from "../attribution/roi";
import { isCustomPlanStep } from "./plan-custom-steps";

/** Format a lead count for Plan UI (keeps one decimal under 10). */
export function formatLeadsMo(leads: number): string {
  const rounded = leads >= 10 ? Math.round(leads) : Math.round(leads * 10) / 10;
  return `${rounded} leads/mo`;
}

function estimateQualifier(
  confidence: PlanStep["context"]["projectionConfidence"]
): "model est." | "est." {
  if (confidence === "high" || confidence === "medium") return "est.";
  return "model est.";
}

/** Short qualitative line for custom LLM steps (no fabricated $/leads). */
export function formatCustomPlanStepSignal(step: PlanStep): string | null {
  if (!isCustomPlanStep(step.stepNumber)) return null;
  if (step.context.selectionRationale?.trim()) {
    const rationale = step.context.selectionRationale.trim();
    return rationale.length > 90 ? `${rationale.slice(0, 87)}…` : rationale;
  }
  if (step.context.expectedEffect?.trim()) {
    return step.context.expectedEffect.trim();
  }
  return "Custom strategist action — follow the expected effect";
}

/** Prefer $/mo when ACV is set; otherwise leads, engagement actions, then score pts. */
export function formatPlanStepImpactLabel(
  step: PlanStep,
  currency = "USD"
): string | null {
  const qualifier = estimateQualifier(step.context.projectionConfidence);

  if ((step.context.revenueImpact ?? 0) > 0) {
    return `+${formatCurrency(step.context.revenueImpact!, currency)}/mo ${qualifier}`;
  }
  if ((step.context.leadsImpact ?? 0) > 0) {
    return `+${formatLeadsMo(step.context.leadsImpact!)} ${qualifier}`;
  }
  if ((step.context.engagementImpact ?? 0) > 0) {
    return `+${step.context.engagementImpact} actions/mo ${qualifier}`;
  }
  if ((step.context.outcomeScoreImpact ?? 0) > 0) {
    return `+${step.context.outcomeScoreImpact} ranking pts`;
  }
  if ((step.context.healthScoreImpact ?? 0) > 0) {
    return `+${step.context.healthScoreImpact} score pts`;
  }

  // Custom steps: never silent — show qualitative signal instead of blank impact.
  return formatCustomPlanStepSignal(step);
}
