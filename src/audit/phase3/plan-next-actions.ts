import type { Plan, PlanStep } from "../types";
import { isConversionPlanStep } from "../phase2/conversion-constants";

const ACTIONABLE: ReadonlySet<PlanStep["status"]> = new Set([
  "pending",
  "needs_approval",
  "approved",
]);

export interface NextBestPlanStepsOptions {
  /**
   * When true (visible profile, weak conversion), overweight conversion-family
   * steps so NBA leads with place actions / CTA posts / replies / attributes.
   */
  preferConversionSteps?: boolean;
}

function stepRank(step: PlanStep): number {
  return step.displayOrder ?? step.stepNumber;
}

function revenueImpact(step: PlanStep): number {
  return step.context.revenueImpact ?? 0;
}

function leadsImpact(step: PlanStep): number {
  return step.context.leadsImpact ?? 0;
}

function engagementImpact(step: PlanStep): number {
  return step.context.engagementImpact ?? 0;
}

function scoreImpactTieBreak(step: PlanStep): number {
  return (
    (step.context.outcomeScoreImpact ?? 0) * 10 + (step.context.healthScoreImpact ?? 0)
  );
}

/** Sort key boost so conversion levers win NBA when the listing is visible but under-acting. */
function conversionModeBoost(step: PlanStep, preferConversionSteps: boolean): number {
  if (!preferConversionSteps || !isConversionPlanStep(step.stepNumber)) return 0;
  return 1_000_000;
}

/** Top unfinished plan steps ordered by revenue, then leads, then engagement, then displayOrder. */
export function selectNextBestPlanSteps(
  plan: Plan,
  limit = 3,
  options: NextBestPlanStepsOptions = {}
): PlanStep[] {
  const preferConversionSteps = options.preferConversionSteps === true;

  return plan.steps
    .filter(
      (step) =>
        ACTIONABLE.has(step.status) && step.stepNumber !== 0 /* google updates shown separately */
    )
    .sort((a, b) => {
      const conversionDiff =
        conversionModeBoost(b, preferConversionSteps) -
        conversionModeBoost(a, preferConversionSteps);
      if (conversionDiff !== 0) return conversionDiff;

      const revenueDiff = revenueImpact(b) - revenueImpact(a);
      if (revenueDiff !== 0) return revenueDiff;
      const leadsDiff = leadsImpact(b) - leadsImpact(a);
      if (leadsDiff !== 0) return leadsDiff;
      const engagementDiff = engagementImpact(b) - engagementImpact(a);
      if (engagementDiff !== 0) return engagementDiff;
      const rankDiff = stepRank(a) - stepRank(b);
      if (rankDiff !== 0) return rankDiff;
      return scoreImpactTieBreak(b) - scoreImpactTieBreak(a);
    })
    .slice(0, limit);
}
