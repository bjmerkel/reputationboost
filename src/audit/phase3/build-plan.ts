import type { ActionAttribution } from "@/audit/types/timeseries";
import type {
  ExecutionTask,
  FullAuditPayload,
  GbpPlanStep,
  Plan,
  PlanPhase,
  PlanStep,
  PlanStepOutcome,
  PlanStepStatus,
  PlanProgress,
} from "../types";
import { getPhaseForStep, PLAN_PHASE_DEFINITIONS } from "./plan-phases";
import { resolvePlanStepNumber } from "./plan-task-utils";
import { buildStepContext } from "./step-context";

function groupTasksByStep(tasks: ExecutionTask[]): Map<number, ExecutionTask[]> {
  const grouped = new Map<number, ExecutionTask[]>();
  for (const task of tasks) {
    const stepNumber = resolvePlanStepNumber(task);
    if (stepNumber == null) continue;
    const existing = grouped.get(stepNumber) ?? [];
    existing.push(task);
    grouped.set(stepNumber, existing);
  }
  return grouped;
}

function deriveStepStatus(tasks: ExecutionTask[]): PlanStepStatus {
  if (tasks.length === 0) return "pending";
  if (tasks.every((t) => t.status === "completed")) return "completed";
  if (tasks.some((t) => t.status === "rejected")) return "skipped";
  if (tasks.some((t) => t.status === "pending_approval")) return "needs_approval";
  if (tasks.every((t) => t.status === "approved" || t.status === "scheduled")) {
    return "approved";
  }
  if (tasks.some((t) => t.status === "failed")) return "needs_approval";
  return "pending";
}

function formatRank(rank: number | null): string {
  if (rank === null) return "—";
  if (rank > 20) return "#20+";
  return `#${rank}`;
}

function buildOutcomeFromAttribution(attr: ActionAttribution): PlanStepOutcome {
  const rankChanged =
    attr.rankBefore !== attr.rankAfter && attr.rankAfter !== null && attr.primaryKeyword;
  const narrative = rankChanged
    ? `Published ${new Date(attr.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} → '${attr.primaryKeyword}' moved ${formatRank(attr.rankBefore)} → ${formatRank(attr.rankAfter)}`
    : attr.narrative;

  return {
    publishedAt: attr.publishedAt,
    attributionId: attr.id,
    rankBefore: attr.rankBefore,
    rankAfter: attr.rankAfter,
    keyword: attr.primaryKeyword ?? undefined,
    narrative,
  };
}

function findStepOutcome(
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
    narrative: `Published ${new Date(completedTask.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · Tracking results…`,
  };
}

function buildPlanStep(
  audit: FullAuditPayload,
  step: GbpPlanStep,
  tasks: ExecutionTask[],
  attributions: ActionAttribution[]
): PlanStep {
  const status = deriveStepStatus(tasks);
  const outcome =
    status === "completed" ? findStepOutcome(step.stepNumber, tasks, attributions) : undefined;

  return {
    stepNumber: step.stepNumber,
    phaseId: getPhaseForStep(step.stepNumber),
    title: step.title,
    instruction: step.instruction,
    context: buildStepContext(audit, step),
    gbpAction: step.gbpAction,
    actionData: step.actionData,
    copyBlocks: step.copyBlocks,
    bullets: step.bullets,
    tasks,
    status,
    outcome,
  };
}

function computeProgress(steps: PlanStep[], currentHealthScore: number): PlanProgress {
  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const needsApproval = steps.filter((s) => s.status === "needs_approval").length;
  const remaining = totalSteps - completedSteps;
  const projectedHealthScore = Math.min(
    100,
    Math.round(currentHealthScore + remaining * 1.5)
  );

  return {
    totalSteps,
    completedSteps,
    needsApproval,
    currentHealthScore,
    projectedHealthScore,
  };
}

function filterPhasesWithSteps(phases: PlanPhase[], steps: PlanStep[]): PlanPhase[] {
  const stepNumbers = new Set(steps.map((s) => s.stepNumber));
  return phases
    .map((phase) => ({
      ...phase,
      stepNumbers: phase.stepNumbers.filter((n) => stepNumbers.has(n)),
    }))
    .filter((phase) => phase.stepNumbers.length > 0);
}

export function buildPlan(
  audit: FullAuditPayload,
  tasks: ExecutionTask[],
  attributions: ActionAttribution[] = []
): Plan | null {
  const gbpPlan = audit.strategy?.gbpPlan;
  if (!gbpPlan) return null;

  const tasksByStep = groupTasksByStep(tasks);
  const planSteps = gbpPlan.steps.map((step) =>
    buildPlanStep(audit, step, tasksByStep.get(step.stepNumber) ?? [], attributions)
  );

  const currentHealthScore = Number.isFinite(audit.strategy.scores?.overall)
    ? audit.strategy.scores.overall
    : 0;

  return {
    title: gbpPlan.title,
    businessName: gbpPlan.businessName,
    objective: gbpPlan.objective,
    targetKeywords: gbpPlan.targetKeywords,
    phases: filterPhasesWithSteps(PLAN_PHASE_DEFINITIONS, planSteps),
    steps: planSteps,
    progress: computeProgress(planSteps, currentHealthScore),
  };
}
