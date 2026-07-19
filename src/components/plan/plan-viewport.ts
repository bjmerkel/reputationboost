import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import {
  getGoogleDiffFields,
  getGooglePendingFields,
} from "@/lib/google/gbp-update-helpers";

export function countGoogleConflictTasks(tasks: ExecutionTask[]): number {
  return tasks.filter(
    (task) => task.type === "gbp_accept_suggestion" || task.type === "gbp_reject_suggestion"
  ).length;
}

export type GoogleUpdatesPresentationMode = "hidden" | "compact" | "full";

export interface GoogleUpdatesPresentation {
  mode: GoogleUpdatesPresentationMode;
  pendingCount: number;
  diffCount: number;
  conflictCount: number;
}

/** Decide whether Google updates block the first viewport or appear as a compact strip. */
export function resolveGoogleUpdatesPresentation(
  audit: FullAuditPayload,
  tasks: ExecutionTask[]
): GoogleUpdatesPresentation {
  const diffFields = getGoogleDiffFields(audit);
  const pendingFields = getGooglePendingFields(audit);
  const conflictCount = countGoogleConflictTasks(tasks);
  const diffCount = diffFields.length;
  const pendingCount = pendingFields.length;

  if (diffCount === 0 && pendingCount === 0) {
    return { mode: "hidden", pendingCount, diffCount, conflictCount };
  }

  if (diffCount > 0 || conflictCount > 0) {
    return { mode: "full", pendingCount, diffCount, conflictCount };
  }

  return { mode: "compact", pendingCount, diffCount, conflictCount };
}

/** Category-default ACV for revenue preview when the user has not set ACV yet. */
export function defaultAcvPreviewHint(audit: FullAuditPayload): number {
  const category = (audit.gbp.identity.primaryCategory || audit.clientName || "").toLowerCase();
  if (/dentist|lawyer|attorney|clinic|doctor/.test(category)) return 500;
  if (/plumber|hvac|electric|roof|contractor|repair|mechanic|landscap/.test(category)) {
    return 350;
  }
  if (/restaurant|retail|store|shop|salon|spa|cafe|bakery|boutique/.test(category)) {
    return 75;
  }
  return 300;
}

export interface AcvRevenuePreview {
  defaultAcv: number;
  projectedMonthlyRevenue: number | null;
  leadGain: number | null;
}

/** Example $/mo from top-3 plan path when only leads are known. */
export function buildAcvRevenuePreview(
  audit: FullAuditPayload,
  options?: {
    nextThreeProjectedMonthlyLeads?: number | null;
    nextThreeEstimatedMonthlyLeads?: number | null;
    projectedMonthlyLeads?: number | null;
    estimatedMonthlyLeads?: number | null;
  }
): AcvRevenuePreview | null {
  const projected =
    options?.nextThreeProjectedMonthlyLeads ??
    options?.projectedMonthlyLeads ??
    null;
  const estimated =
    options?.nextThreeEstimatedMonthlyLeads ??
    options?.estimatedMonthlyLeads ??
    null;

  if (projected == null || projected <= 0) return null;

  const defaultAcv = defaultAcvPreviewHint(audit);
  const leadGain =
    estimated != null && projected > estimated ? projected - estimated : projected;

  return {
    defaultAcv,
    projectedMonthlyRevenue: Math.round(projected * defaultAcv),
    leadGain: leadGain > 0 ? leadGain : null,
  };
}
