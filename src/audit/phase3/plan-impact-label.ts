import type { PlanStep } from "../types";
import { formatCurrency } from "../attribution/roi";

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
  return null;
}
