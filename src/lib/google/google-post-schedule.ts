import type { ExecutionTask } from "@/audit/types";

/** Days between weekly Google post slots (step 8 cadence). */
export const GOOGLE_POST_WEEK_DAYS = 7;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Default publish time for post slot `postIndex` (1-based week number). */
export function defaultGooglePostScheduledFor(postIndex: number, from = new Date()): string {
  const weeks = Math.max(1, postIndex);
  return addDays(from, GOOGLE_POST_WEEK_DAYS * weeks).toISOString();
}

export function isFutureScheduled(scheduledFor: string | null | undefined): boolean {
  if (!scheduledFor) return false;
  return new Date(scheduledFor).getTime() > Date.now();
}

export function googlePostAwaitingScheduledPublish(task: ExecutionTask): boolean {
  return (
    task.type === "google_post" &&
    task.status === "approved" &&
    task.scheduledFor != null &&
    isFutureScheduled(task.scheduledFor)
  );
}

export function googlePostShouldScheduleOnly(
  task: ExecutionTask,
  publishNow?: boolean
): boolean {
  return task.type === "google_post" && !publishNow && isFutureScheduled(task.scheduledFor);
}
