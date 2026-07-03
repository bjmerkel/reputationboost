import type { ExecutionTask, PlanPhaseId } from "../types";
import { getPhaseForStep } from "./plan-phases";

export function resolvePlanStepNumber(task: ExecutionTask): number | null {
  if (task.planStepNumber != null) return task.planStepNumber;

  const fromPayload = task.payload.gbpStepNumber;
  if (typeof fromPayload === "number") return fromPayload;

  const match = task.actionItemId.match(/^gbp-step-(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function backfillTaskPlanFields(task: ExecutionTask): ExecutionTask {
  const planStepNumber = resolvePlanStepNumber(task);
  const planPhaseId =
    task.planPhaseId ??
    (typeof task.payload.planPhaseId === "string"
      ? (task.payload.planPhaseId as PlanPhaseId)
      : planStepNumber != null
        ? getPhaseForStep(planStepNumber)
        : null);

  return {
    ...task,
    planStepNumber,
    planPhaseId,
  };
}
