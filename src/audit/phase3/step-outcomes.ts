import type { ActionAttribution } from "@/audit/types/timeseries";
import type { ExecutionTask, PlanStepOutcome } from "../types";

export function formatOutcomeRank(rank: number | null): string {
  if (rank === null) return "—";
  if (rank > 20) return "#20+";
  return `#${rank}`;
}

export function buildOutcomeFromAttribution(attr: ActionAttribution): PlanStepOutcome {
  const rankChanged =
    attr.rankBefore !== attr.rankAfter && attr.rankAfter !== null && attr.primaryKeyword;
  const narrative = rankChanged
    ? `Published ${formatOutcomeDate(attr.publishedAt)} → '${attr.primaryKeyword}' moved ${formatOutcomeRank(attr.rankBefore)} → ${formatOutcomeRank(attr.rankAfter)}`
    : attr.narrative;

  return {
    publishedAt: attr.publishedAt,
    attributionId: attr.id,
    rankBefore: attr.rankBefore,
    rankAfter: attr.rankAfter,
    keyword: attr.primaryKeyword ?? undefined,
    narrative,
    projectedDriverImpact: attr.projectedDriverImpact,
    observedDriverImpact: attr.observedDriverImpact,
    driverScoreBefore: attr.driverScoreBefore,
    driverScoreAfter: attr.driverScoreAfter,
  };
}

export function findStepOutcome(
  stepNumber: number,
  tasks: ExecutionTask[],
  attributions: ActionAttribution[]
): PlanStepOutcome | undefined {
  const taskIds = new Set(tasks.map((t) => t.id));
  const byActionItem = attributions.find((a) => a.actionItemId === `gbp-step-${stepNumber}`);
  if (byActionItem) return buildOutcomeFromAttribution(byActionItem);

  const byTask = attributions.find((a) => taskIds.has(a.executionTaskId));
  if (byTask) return buildOutcomeFromAttribution(byTask);

  const completedTask = tasks.find((t) => t.status === "completed" && t.completedAt);
  if (!completedTask?.completedAt) return undefined;

  if (completedTask.result) {
    return {
      publishedAt: completedTask.completedAt,
      narrative: completedTask.result,
    };
  }

  return {
    publishedAt: completedTask.completedAt,
    narrative: `Published ${formatOutcomeDate(completedTask.completedAt)} · Tracking results…`,
  };
}

function formatOutcomeDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
