import type { ExecutionTask, PlanStepStatus } from "../types";

function isTerminalTaskStatus(status: ExecutionTask["status"]): boolean {
  return status === "completed" || status === "rejected";
}

/** Derive plan-step status from its tasks; rejected tasks are terminal per-task. */
export function deriveStepStatus(tasks: ExecutionTask[]): PlanStepStatus {
  if (tasks.length === 0) return "pending";

  const active = tasks.filter((task) => !isTerminalTaskStatus(task.status));

  if (active.length === 0) {
    if (tasks.every((task) => task.status === "completed")) return "completed";
    if (tasks.every((task) => task.status === "rejected")) return "skipped";
    return "completed";
  }

  if (active.some((task) => task.status === "pending_approval")) return "needs_approval";
  if (active.some((task) => task.status === "failed")) return "needs_approval";
  if (active.every((task) => task.status === "approved" || task.status === "scheduled")) {
    return "approved";
  }
  return "pending";
}
