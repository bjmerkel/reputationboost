import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import {
  defaultAcvPreviewHint,
} from "@/lib/business/acv-defaults";
import { roundLeadCount } from "@/audit/phase3/plan-impact-label";
import {
  getGoogleDiffFields,
  getGooglePendingFields,
} from "@/lib/google/gbp-update-helpers";

const MIN_LEAD_GAIN = 0.05;

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

export { defaultAcvPreviewHint } from "@/lib/business/acv-defaults";

export interface AcvRevenuePreview {
  defaultAcv: number;
  projectedMonthlyLeads?: number | null;
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
    estimatedAcv?: number | null;
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

  const defaultAcv =
    options?.estimatedAcv != null && options.estimatedAcv > 0
      ? options.estimatedAcv
      : defaultAcvPreviewHint(audit);
  const rawLeadGain =
    estimated != null && projected > estimated + MIN_LEAD_GAIN
      ? projected - estimated
      : estimated == null
        ? projected
        : null;
  const leadGain = rawLeadGain != null ? roundLeadCount(rawLeadGain) : null;

  return {
    defaultAcv,
    projectedMonthlyLeads: projected,
    projectedMonthlyRevenue: Math.round(projected * defaultAcv),
    leadGain: leadGain != null && leadGain > 0 ? leadGain : null,
  };
}
