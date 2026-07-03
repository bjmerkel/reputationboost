import type { ExecutionTask } from "@/audit/types";
import { resolvePlanStepNumber } from "@/audit/phase3/plan-task-utils";

const PRIORITY_ORDER: Record<ExecutionTask["priority"], number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export const ROUTINE_TASK_TYPES = new Set<ExecutionTask["type"]>([
  "gbp_description",
  "gbp_services",
  "gbp_attributes",
  "gbp_website",
  "gbp_primary_category",
  "gbp_secondary_categories",
]);

export function isRoutineTask(task: ExecutionTask): boolean {
  return ROUTINE_TASK_TYPES.has(task.type);
}

export function isBatchReviewable(task: ExecutionTask): boolean {
  if (task.status !== "pending_approval") return false;
  if (task.type === "gbp_photo") {
    return typeof task.payload.previewDataUrl === "string";
  }
  return true;
}

export function sortPendingTasks(tasks: ExecutionTask[]): ExecutionTask[] {
  return tasks
    .filter((t) => t.status === "pending_approval")
    .sort((a, b) => {
      const stepA = resolvePlanStepNumber(a) ?? 99;
      const stepB = resolvePlanStepNumber(b) ?? 99;
      if (stepA !== stepB) return stepA - stepB;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });
}

export function pendingBatchTasks(tasks: ExecutionTask[]): ExecutionTask[] {
  return sortPendingTasks(tasks).filter(isBatchReviewable);
}

export function pendingRoutineTasks(tasks: ExecutionTask[]): ExecutionTask[] {
  return pendingBatchTasks(tasks).filter(isRoutineTask);
}
