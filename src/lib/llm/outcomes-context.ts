import type { OutcomesContext } from "@/audit/outcomes/types";

/** Serialize outcomes for LLM strategy and GBP plan prompts. */
export function buildOutcomesContext(outcomes: OutcomesContext | null | undefined): string {
  if (!outcomes) return "";

  const payload = {
    provenWins: outcomes.provenWins.slice(0, 6),
    whatDidntWork: outcomes.whatDidntWork.slice(0, 4),
    correlations: outcomes.correlations,
    monthlyEstimatedRevenue: outcomes.monthlyEstimatedRevenue,
    tasksCompleted: outcomes.tasksCompleted,
    tasksSkipped: outcomes.tasksSkipped,
    priorKpiTargets: outcomes.priorKpiTargets,
    completedTaskTypes: outcomes.completedTaskTypes,
    topPerformingKeywords: outcomes.topPerformingKeywords,
  };

  return JSON.stringify(payload, null, 2);
}

export const OUTCOMES_STRATEGY_INSTRUCTION = `When ACTION OUTCOMES are provided:
- Prioritize strategies that replicate proven wins (task types and keywords that drove rank or engagement gains).
- Do not recommend repeating action types listed under whatDidntWork unless the audit shows a new urgent gap.
- Reference specific attributed results in executiveSummary and biggestWin when available.
- Set kpiTargets based on proven velocity (e.g. if posts drove +4 rank positions, target 2 posts/week on topPerformingKeywords).`;
