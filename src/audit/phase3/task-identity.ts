import type { ExecutionStatus, ExecutionTask, ExecutionType } from "../types";
import { resolvePlanStepNumber } from "./plan-task-utils";

/** Statuses that reconcile must never mutate. */
export const RECONCILE_IMMUTABLE_STATUSES = new Set<ExecutionStatus>([
  "approved",
  "scheduled",
  "completed",
  "rejected",
]);

/** Statuses that still represent open work for dedupe / missing-task checks. */
export const RECONCILE_ACTIVE_STATUSES = new Set<ExecutionStatus>([
  "pending_approval",
  "approved",
  "scheduled",
  "failed",
]);

function payloadString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (value == null) return "";
  return String(value).trim();
}

function normalizeVideoTitle(title: string): string {
  return title.replace(/^Step \d+:\s*/i, "").trim().toLowerCase();
}

function attributeBatchKey(payload: Record<string, unknown>): string {
  const attributes = payload.attributes;
  if (!Array.isArray(attributes) || attributes.length === 0) return "";
  return attributes
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      return String((item as { name?: unknown }).name ?? "").trim();
    })
    .filter(Boolean)
    .sort()
    .join(",");
}

function placeActionTypesKey(payload: Record<string, unknown>): string {
  const types = payload.placeActionTypes;
  if (!Array.isArray(types) || types.length === 0) {
    return payloadString(payload, "placeActionType");
  }
  return types
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return String((item as { placeActionType?: unknown }).placeActionType ?? "").trim();
      }
      return "";
    })
    .filter(Boolean)
    .sort()
    .join(",");
}

/**
 * Stable identity for reconcile dedupe / missing-task detection.
 * Does not include task id, draft content, or status.
 */
export function taskIdentityKey(task: Pick<ExecutionTask, "type" | "title" | "actionItemId" | "payload" | "planStepNumber">): string {
  const type: ExecutionType = task.type;
  const payload = task.payload ?? {};
  const step = resolvePlanStepNumber(task as ExecutionTask);

  switch (type) {
    case "gbp_accept_suggestion":
    case "gbp_reject_suggestion":
      return `${type}|field:${payloadString(payload, "suggestionField")}`;

    case "gbp_title":
    case "gbp_phone":
    case "gbp_website":
    case "gbp_address": {
      const napField = payloadString(payload, "napField");
      if (napField) return `${type}|nap:${napField}`;
      const suggestionField = payloadString(payload, "suggestionField");
      if (suggestionField) return `${type}|field:${suggestionField}`;
      return `${type}|step:${step ?? "none"}`;
    }

    case "gbp_media_delete":
    case "gbp_media_recategorize":
      return `${type}|media:${payloadString(payload, "mediaName")}`;

    case "gbp_photo":
      return `${type}|category:${payloadString(payload, "category")}`;

    case "gbp_video":
      return `${type}|title:${normalizeVideoTitle(task.title)}`;

    case "review_response":
    case "review_delete_reply":
    case "review_dispute":
      return `${type}|review:${payloadString(payload, "reviewId")}`;

    case "gbp_hours": {
      const action = payloadString(payload, "hoursAction") || "update_hours";
      const year = payloadString(payload, "holidayYear");
      return year ? `${type}|hours:${action}|year:${year}` : `${type}|hours:${action}`;
    }

    case "gbp_place_action": {
      const typesKey = placeActionTypesKey(payload);
      return typesKey
        ? `${type}|actions:${typesKey}`
        : `${type}|step:${step ?? "none"}`;
    }

    case "gbp_notifications":
      return `${type}|step:${step ?? 16}`;

    case "update_tracked_keywords":
      return `${type}|step:${step ?? 17}`;

    case "gbp_attributes": {
      const batch = attributeBatchKey(payload);
      return batch
        ? `${type}|step:${step ?? "none"}|attrs:${batch}`
        : `${type}|step:${step ?? "none"}`;
    }

    case "google_post": {
      const postIndex = payloadString(payload, "postIndex");
      return `${type}|step:${step ?? "none"}|post:${postIndex || "1"}`;
    }

    case "gbp_checklist":
      return `${type}|step:${step ?? "none"}|title:${normalizeVideoTitle(task.title)}`;

    case "gbp_description":
    case "gbp_primary_category":
    case "gbp_secondary_categories":
    case "gbp_services":
      return `${type}|step:${step ?? "none"}`;

    case "review_request":
    case "schema_markup":
    case "social_post":
      return `${type}|action:${task.actionItemId || "none"}`;

    default:
      return `${type}|step:${step ?? "none"}|action:${task.actionItemId || "none"}`;
  }
}

export function isTerminalTaskStatus(status: ExecutionStatus): boolean {
  return status === "completed" || status === "rejected";
}

/** True when reconcile may change status (pending / failed only). */
export function isMutableByReconcile(task: Pick<ExecutionTask, "status">): boolean {
  return !RECONCILE_IMMUTABLE_STATUSES.has(task.status);
}

/**
 * Open work that should block creating a duplicate candidate.
 * Matches Google Updates: completed/rejected do not block a new task for the same identity.
 */
export function isActiveReconcileTask(task: Pick<ExecutionTask, "status">): boolean {
  return RECONCILE_ACTIVE_STATUSES.has(task.status);
}

export function findActiveTaskByIdentity(
  existing: ExecutionTask[],
  identityKey: string
): ExecutionTask | undefined {
  return existing.find(
    (task) => isActiveReconcileTask(task) && taskIdentityKey(task) === identityKey
  );
}

/**
 * Return candidates that do not already have an active task with the same identity.
 * Pattern used by missingGoogleSuggestionTasks / ensure-photo-tasks.
 */
export function filterMissingTasks(
  candidates: ExecutionTask[],
  existing: ExecutionTask[]
): ExecutionTask[] {
  const activeKeys = new Set(
    existing.filter(isActiveReconcileTask).map((task) => taskIdentityKey(task))
  );
  return candidates.filter((candidate) => !activeKeys.has(taskIdentityKey(candidate)));
}
