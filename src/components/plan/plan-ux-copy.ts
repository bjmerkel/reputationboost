import type { ExecutionTask, Plan, PlanStep } from "@/audit/types";

/** Task types that only mark local completion — no GBP API publish. */
const LOCAL_COMPLETE_TASK_TYPES = new Set<ExecutionTask["type"]>([
  "gbp_checklist",
  "review_dispute",
  "review_request",
  "schema_markup",
  "social_post",
]);

export function taskUsesLocalCompletion(task: ExecutionTask): boolean {
  return LOCAL_COMPLETE_TASK_TYPES.has(task.type);
}

export function taskPrimaryActionLabel(
  task: ExecutionTask,
  options?: { loading?: boolean; republish?: boolean }
): string {
  if (options?.loading) {
    return options.republish ? "Publishing…" : taskUsesLocalCompletion(task) ? "Saving…" : "Publishing…";
  }
  if (options?.republish) return "Save & re-publish";
  if (taskUsesLocalCompletion(task)) return "Mark complete";
  return "Approve & publish";
}

export function planStepHasPublishableTasks(step: PlanStep): boolean {
  return step.tasks.some(
    (task) =>
      task.status !== "completed" &&
      task.status !== "rejected" &&
      task.type !== "gbp_photo" &&
      task.type !== "gbp_video" &&
      !taskUsesLocalCompletion(task) &&
      task.type !== "review_request" &&
      task.type !== "review_dispute"
  );
}

export function planHasManualSteps(plan: Plan): boolean {
  return plan.steps.some(
    (step) => step.status !== "completed" && step.status !== "skipped" && step.tasks.length === 0
  );
}

/** Top-of-plan GBP guidance — null when disconnected or nothing actionable. */
export function planGbpBannerMessage(plan: Plan, gbpConnected: boolean): string | null {
  if (!gbpConnected) return null;

  const hasPublishable = plan.steps.some(planStepHasPublishableTasks);
  const hasManual = planHasManualSteps(plan);
  if (!hasPublishable && !hasManual) return null;

  const parts: string[] = [];
  if (hasPublishable) {
    parts.push(
      "Steps with drafts below can be approved and published to your Google Business Profile."
    );
  }
  if (hasManual) {
    parts.push(
      "Manual items must be completed in Google first, then refresh your plan to pick up changes."
    );
  }
  return parts.join(" ");
}

export function reconcileFeedbackMessage(options: {
  completedTasks: number;
  createdTasks: number;
}): string {
  const { completedTasks, createdTasks } = options;
  if (completedTasks > 0 && createdTasks > 0) {
    return `Plan refreshed — ${completedTasks} task${completedTasks === 1 ? "" : "s"} marked complete and ${createdTasks} new task${createdTasks === 1 ? "" : "s"} added.`;
  }
  if (completedTasks > 0) {
    return `Plan refreshed — ${completedTasks} task${completedTasks === 1 ? "" : "s"} marked complete.`;
  }
  if (createdTasks > 0) {
    return `Plan updated — ${createdTasks} new task${createdTasks === 1 ? "" : "s"} added.`;
  }
  return "Plan refreshed — no new changes found in your latest audit data.";
}

export const MANUAL_STEP_HELPER =
  "Manual step — complete this update in Google Business Profile, then refresh your plan.";

export const MANUAL_STEP_SYNC_LABEL = "I did this in Google — refresh plan";
