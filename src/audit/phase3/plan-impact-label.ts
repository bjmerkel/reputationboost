import type { PlanStep } from "../types";
import { formatCurrency } from "../attribution/roi";

/** Prefer $/mo when ACV is set; otherwise show leads/mo, then score pts. */
export function formatPlanStepImpactLabel(
  step: PlanStep,
  currency = "USD"
): string | null {
  if ((step.context.revenueImpact ?? 0) > 0) {
    return `+${formatCurrency(step.context.revenueImpact!, currency)}/mo est.`;
  }
  if ((step.context.leadsImpact ?? 0) > 0) {
    const leads = step.context.leadsImpact!;
    const rounded = leads >= 10 ? Math.round(leads) : Math.round(leads * 10) / 10;
    return `+${rounded} leads/mo est.`;
  }
  if ((step.context.outcomeScoreImpact ?? 0) > 0) {
    return `+${step.context.outcomeScoreImpact} ranking pts`;
  }
  if ((step.context.healthScoreImpact ?? 0) > 0) {
    return `+${step.context.healthScoreImpact} score pts`;
  }
  return null;
}
