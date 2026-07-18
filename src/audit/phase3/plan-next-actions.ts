import type { Plan, PlanStep } from "../types";

const ACTIONABLE: ReadonlySet<PlanStep["status"]> = new Set([
  "pending",
  "needs_approval",
  "approved",
]);

function stepRank(step: PlanStep): number {
  return step.displayOrder ?? step.stepNumber;
}

function revenueImpact(step: PlanStep): number {
  return step.context.revenueImpact ?? 0;
}

function leadsImpact(step: PlanStep): number {
  return step.context.leadsImpact ?? 0;
}

function scoreImpactTieBreak(step: PlanStep): number {
  return (
    (step.context.outcomeScoreImpact ?? 0) * 10 + (step.context.healthScoreImpact ?? 0)
  );
}

/** Top unfinished plan steps ordered by revenue, then leads, then displayOrder. */
export function selectNextBestPlanSteps(plan: Plan, limit = 3): PlanStep[] {
  return plan.steps
    .filter(
      (step) =>
        ACTIONABLE.has(step.status) && step.stepNumber !== 0 /* google updates shown separately */
    )
    .sort((a, b) => {
      const revenueDiff = revenueImpact(b) - revenueImpact(a);
      if (revenueDiff !== 0) return revenueDiff;
      const leadsDiff = leadsImpact(b) - leadsImpact(a);
      if (leadsDiff !== 0) return leadsDiff;
      const rankDiff = stepRank(a) - stepRank(b);
      if (rankDiff !== 0) return rankDiff;
      return scoreImpactTieBreak(b) - scoreImpactTieBreak(a);
    })
    .slice(0, limit);
}
