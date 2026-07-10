/** Feature flags for geo-grid heatmap rollout (Pillars 1–5). */
import type { GridProfileKey } from "@/lib/google/geo-grid";

/** Daily plan reconciliation (append missing tasks / auto-complete stale pending). */
export const PLAN_RECONCILE_FLAGS = {
  enabled: true,
} as const;

export const HEATMAP_FLAGS = {
  insightPanel: true,
  zoneHighlights: true,
  gridDiff: true,
  heatmapLayer: true,
  competitorDominance: true,
  competitorTerritories: true,
  serviceAreaOverlay: true,
  gbpServiceArea: true,
  /** Legacy profile preference retained for stored pre-radial grids. */
  gridProfile: "compact" as GridProfileKey,
  /** Legacy profile preference retained for stored pre-radial grids. */
  auditGridProfile: "compact" as GridProfileKey,
  /** Legacy profile preference retained for stored pre-radial grids. */
  weeklyGridProfile: "compact" as GridProfileKey,
  /** @deprecated Daily ingest now records only the business-pin Text Search baseline. */
  dailyMultiRadius: false,
  /** Max keywords per business in weekly grid cron */
  weeklyKeywordLimit: 3,
  /** Reuse a stored weekly grid during audits when newer than this many days */
  auditReuseWeeklyGridDays: 7,
} as const;

export type HeatmapCollectionContext = "audit" | "weekly" | "task_trigger" | "api";

/** Resolve which grid profile to use for a collection context. */
export function gridProfileForCollection(
  context: HeatmapCollectionContext,
  businessProfile?: GridProfileKey | null
): GridProfileKey {
  if (context === "weekly") {
    return HEATMAP_FLAGS.weeklyGridProfile;
  }

  if (context === "audit") {
    return HEATMAP_FLAGS.auditGridProfile;
  }

  if (businessProfile) {
    return businessProfile;
  }

  return HEATMAP_FLAGS.gridProfile;
}
