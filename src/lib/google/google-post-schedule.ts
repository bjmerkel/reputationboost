import type { ExecutionTask } from "@/audit/types";

/** Days between weekly Google post slots (step 8 cadence). */
export const GOOGLE_POST_WEEK_DAYS = 7;

/** Minimum lead time before a user-selected publish time (cron runs every 15 min). */
export const GOOGLE_POST_MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;

/** Maximum schedule horizon. */
export const GOOGLE_POST_MAX_SCHEDULE_LEAD_MS = 365 * 24 * 60 * 60 * 1000;

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

export function minGooglePostScheduleTime(from = new Date()): Date {
  return new Date(from.getTime() + GOOGLE_POST_MIN_SCHEDULE_LEAD_MS);
}

export function defaultGooglePostScheduleInput(
  task: Pick<ExecutionTask, "scheduledFor" | "payload">
): string {
  if (task.scheduledFor && isFutureScheduled(task.scheduledFor)) {
    return isoToDatetimeLocalValue(task.scheduledFor);
  }
  const postIndex =
    typeof task.payload.postIndex === "number" ? task.payload.postIndex : 1;
  return isoToDatetimeLocalValue(defaultGooglePostScheduledFor(postIndex));
}

export function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function datetimeLocalValueToIso(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function validateGooglePostScheduleTime(
  scheduledFor: string | null | undefined
): string | null {
  if (!scheduledFor) return "Choose a publish date and time.";
  const ms = new Date(scheduledFor).getTime();
  if (Number.isNaN(ms)) return "Invalid publish time.";
  const now = Date.now();
  if (ms < now + GOOGLE_POST_MIN_SCHEDULE_LEAD_MS) {
    return "Publish time must be at least 5 minutes in the future.";
  }
  if (ms > now + GOOGLE_POST_MAX_SCHEDULE_LEAD_MS) {
    return "Publish time must be within one year.";
  }
  return null;
}

export function googlePostIsScheduled(task: ExecutionTask): boolean {
  return (
    task.type === "google_post" &&
    task.status === "scheduled" &&
    task.scheduledFor != null &&
    isFutureScheduled(task.scheduledFor)
  );
}

export function googlePostAwaitingScheduledPublish(task: ExecutionTask): boolean {
  return (
    task.type === "google_post" &&
    (task.status === "scheduled" || task.status === "approved") &&
    task.scheduledFor != null &&
    isFutureScheduled(task.scheduledFor)
  );
}

export function googlePostShouldScheduleOnly(
  task: ExecutionTask,
  publishNow?: boolean,
  scheduledFor?: string | null
): boolean {
  if (task.type !== "google_post" || publishNow) return false;
  if (task.status === "scheduled") return true;
  const effectiveScheduledFor = scheduledFor ?? task.scheduledFor;
  return isFutureScheduled(effectiveScheduledFor);
}

/** True when a google post should be queued, not published via execute. */
export function googlePostShouldQueue(
  task: ExecutionTask,
  options?: { publishNow?: boolean; scheduledFor?: string | null }
): boolean {
  const scheduledFor = options?.scheduledFor ?? task.scheduledFor;
  return googlePostShouldScheduleOnly(task, options?.publishNow, scheduledFor);
}

export function googlePostScheduleSummary(tasks: ExecutionTask[]): string | null {
  const schedulable = tasks.filter(
    (task) =>
      task.type === "google_post" &&
      task.status !== "completed" &&
      task.status !== "rejected" &&
      task.scheduledFor &&
      (task.status === "scheduled" ||
        task.status === "pending_approval" ||
        googlePostAwaitingScheduledPublish(task))
  );
  if (schedulable.length === 0) return null;

  const scheduledCount = schedulable.filter(
    (task) => task.status === "scheduled" || googlePostAwaitingScheduledPublish(task)
  ).length;
  const nextIso = schedulable
    .map((task) => task.scheduledFor)
    .filter((value): value is string => typeof value === "string")
    .sort()[0];

  if (!nextIso) return null;

  const nextLabel = new Date(nextIso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (scheduledCount > 0) {
    return `${scheduledCount} scheduled · next ${nextLabel}`;
  }
  return `Next slot ${nextLabel}`;
}

export function googlePostPublishFailed(task: ExecutionTask): boolean {
  return task.type === "google_post" && task.status === "failed";
}

/** Open google_post tasks with a publish time, sorted soonest first. */
export function upcomingGooglePostTasks(tasks: ExecutionTask[]): ExecutionTask[] {
  return tasks
    .filter(
      (task) =>
        task.type === "google_post" &&
        task.status !== "completed" &&
        task.status !== "rejected" &&
        task.scheduledFor != null &&
        (task.status === "pending_approval" ||
          task.status === "scheduled" ||
          googlePostAwaitingScheduledPublish(task))
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledFor ?? 0).getTime() - new Date(b.scheduledFor ?? 0).getTime()
    );
}

export function failedGooglePostTasks(tasks: ExecutionTask[]): ExecutionTask[] {
  return tasks
    .filter((task) => googlePostPublishFailed(task))
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? b.createdAt).getTime() -
        new Date(a.completedAt ?? a.createdAt).getTime()
    );
}
