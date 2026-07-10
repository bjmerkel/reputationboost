import { buildTemplateContent, type AuditGeneratedContent } from "@/lib/llm/content";
import { missingGoogleSuggestionTasks } from "@/lib/google/gbp-update-helpers";
import type { ExecutionTask, FullAuditPayload } from "../types";
import {
  buildPhotoExecutionTasks,
  tasksFromGbpPlan,
  tasksFromMediaMaintenance,
  tasksFromNapDrift,
  tasksFromNotificationGaps,
  tasksFromPlaceActionGaps,
  tasksFromVideoGaps,
} from "./gbp-plan-tasks";
import { filterMissingTasks } from "./task-identity";

export interface CollectReconcileCandidatesOptions {
  content?: AuditGeneratedContent;
  /** When false, skip photo task candidates (default true). */
  includePhotos?: boolean;
}

/**
 * Build the full set of tasks reconcile might append, then drop ones that
 * already have an active identity match in `existing`.
 */
export function collectMissingReconcileTasks(
  audit: FullAuditPayload,
  existing: ExecutionTask[],
  options: CollectReconcileCandidatesOptions = {}
): ExecutionTask[] {
  const content = options.content ?? buildTemplateContent(audit);
  const includePhotos = options.includePhotos !== false;

  const candidates: ExecutionTask[] = [
    ...tasksFromGbpPlan(audit, content),
    ...tasksFromNapDrift(audit),
    ...tasksFromMediaMaintenance(audit),
    ...tasksFromVideoGaps(audit),
    ...tasksFromPlaceActionGaps(audit),
    ...tasksFromNotificationGaps(audit),
  ];

  if (includePhotos) {
    candidates.push(...buildPhotoExecutionTasks(audit, content));
  }

  // Google suggestion helper already filters against existing active tasks.
  const suggestionMissing = missingGoogleSuggestionTasks(audit, existing);

  return [
    ...filterMissingTasks(candidates, existing),
    ...filterMissingTasks(suggestionMissing, existing),
  ];
}
