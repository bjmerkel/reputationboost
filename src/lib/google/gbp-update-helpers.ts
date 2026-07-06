import { tasksFromGoogleSuggestions } from "@/audit/phase3/gbp-plan-tasks";
import type { ExecutionTask, FullAuditPayload, GbpGoogleSuggestion } from "@/audit/types";

export const GOOGLE_UPDATES_STEP_NUMBER = 0;

export function getGoogleDiffFields(audit: FullAuditPayload): GbpGoogleSuggestion[] {
  return (
    audit.gbp.googleUpdateState?.diffFields ??
    audit.gbp.googleSuggestions?.filter((suggestion) => suggestion.kind !== "pending") ??
    []
  );
}

export function getGooglePendingFields(audit: FullAuditPayload): GbpGoogleSuggestion[] {
  return (
    audit.gbp.googleUpdateState?.pendingFields ??
    audit.gbp.googleSuggestions?.filter((suggestion) => suggestion.kind === "pending") ??
    []
  );
}

export function hasUnresolvedGoogleDiffs(audit: FullAuditPayload | null | undefined): boolean {
  if (!audit) return false;
  return getGoogleDiffFields(audit).length > 0;
}

export function needsGoogleUpdateRefresh(
  audit: FullAuditPayload | null | undefined,
  gbpGoogleUpdateAt?: string | null
): boolean {
  if (!gbpGoogleUpdateAt || !audit?.completedAt) return false;
  return new Date(gbpGoogleUpdateAt).getTime() > new Date(audit.completedAt).getTime();
}

export function isActiveSuggestionTask(task: ExecutionTask): boolean {
  return (
    (task.type === "gbp_accept_suggestion" || task.type === "gbp_reject_suggestion") &&
    task.status !== "completed" &&
    task.status !== "rejected"
  );
}

export function missingGoogleSuggestionTasks(
  audit: FullAuditPayload,
  existing: ExecutionTask[]
): ExecutionTask[] {
  const auditForTasks =
    (audit.gbp.googleSuggestions?.length ?? 0) > 0
      ? audit
      : {
          ...audit,
          gbp: {
            ...audit.gbp,
            googleSuggestions: getGoogleDiffFields(audit),
          },
        };
  const candidates = tasksFromGoogleSuggestions(auditForTasks);
  return candidates.filter((task) => {
    const field = String(task.payload.suggestionField ?? "");
    return !existing.some(
      (existingTask) =>
        existingTask.type === task.type &&
        String(existingTask.payload.suggestionField ?? "") === field &&
        isActiveSuggestionTask(existingTask)
    );
  });
}
