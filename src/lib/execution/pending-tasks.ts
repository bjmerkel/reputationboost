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

function numericPayload(task: ExecutionTask, keys: string[]): number {
  const payload = task.payload ?? {};
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

/** Impact sort key aligned with Next Best Actions (revenue → leads → engagement). */
export function taskImpactScore(task: ExecutionTask): number {
  const revenue = numericPayload(task, ["projectedRevenueGain", "revenueImpact"]);
  const leads = numericPayload(task, ["projectedLeadsGain", "leadsImpact"]);
  const engagement = numericPayload(task, [
    "projectedEngagementGain",
    "engagementImpact",
  ]);
  return revenue * 1000 + leads * 50 + engagement * 10;
}

/** Sort pending approvals by impact (NBA order), then priority, then step number. */
export function sortPendingTasks(tasks: ExecutionTask[]): ExecutionTask[] {
  return tasks
    .filter((t) => t.status === "pending_approval")
    .sort((a, b) => {
      const impactDiff = taskImpactScore(b) - taskImpactScore(a);
      if (impactDiff !== 0) return impactDiff;
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const stepA = resolvePlanStepNumber(a) ?? 99;
      const stepB = resolvePlanStepNumber(b) ?? 99;
      return stepA - stepB;
    });
}

export function pendingBatchTasks(tasks: ExecutionTask[]): ExecutionTask[] {
  return sortPendingTasks(tasks).filter(isBatchReviewable);
}

export function pendingRoutineTasks(tasks: ExecutionTask[]): ExecutionTask[] {
  return pendingBatchTasks(tasks).filter(isRoutineTask);
}
