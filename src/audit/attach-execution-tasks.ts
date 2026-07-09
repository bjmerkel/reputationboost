import type { ExecutionTask, FullAuditPayload } from "./types";

/** Attach DB-loaded execution tasks so ensureStrategy skips queue regeneration. */
export function attachExecutionTasks(
  audit: FullAuditPayload,
  tasks: ExecutionTask[]
): FullAuditPayload {
  if (tasks.length === 0) return audit;

  const hasPlanBasedTasks = tasks.some((task) => task.actionItemId.startsWith("gbp-step-"));
  if (!hasPlanBasedTasks) return audit;

  if (audit.execution?.tasks.some((task) => task.actionItemId.startsWith("gbp-step-"))) {
    return audit;
  }

  return {
    ...audit,
    execution: {
      generatedAt: audit.completedAt ?? new Date().toISOString(),
      tasksCreated: tasks.length,
      pendingApproval: tasks.filter((task) => task.status === "pending_approval").length,
      autoApproved: tasks.filter(
        (task) => task.status === "approved" || task.status === "completed"
      ).length,
      tasks,
    },
  };
}
