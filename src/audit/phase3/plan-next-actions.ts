import type { Plan, PlanStep } from "../types";

const ACTIONABLE: ReadonlySet<PlanStep["status"]> = new Set([
  "pending",
  "needs_approval",
  "approved",
]);

function stepRank(step: PlanStep): number {
  return step.displayOrder ?? step.stepNumber;
}

function impactTieBreak(step: PlanStep): number {
  return (
    (step.context.revenueImpact ?? 0) * 1000 +
    (step.context.outcomeScoreImpact ?? 0) * 10 +
    (step.context.healthScoreImpact ?? 0)
  );
}

/** Top unfinished plan steps ordered by impact (for Plan "Next best actions"). */
export function selectNextBestPlanSteps(plan: Plan, limit = 3): PlanStep[] {
  return plan.steps
    .filter(
      (step) =>
        ACTIONABLE.has(step.status) && step.stepNumber !== 0 /* google updates shown separately */
    )
    .sort((a, b) => {
      const rankDiff = stepRank(a) - stepRank(b);
      if (rankDiff !== 0) return rankDiff;
      return impactTieBreak(b) - impactTieBreak(a);
    })
    .slice(0, limit);
}
