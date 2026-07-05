/** Feature flags for geo-grid heatmap rollout (Pillars 1–4). */
import type { GridProfileKey } from "@/lib/google/geo-grid";

export const HEATMAP_FLAGS = {
  insightPanel: true,
  zoneHighlights: true,
  gridDiff: true,
  heatmapLayer: true,
  competitorDominance: true,
  serviceAreaOverlay: true,
  /** Live audit + on-demand grid fetches */
  gridProfile: "standard" as GridProfileKey,
  /** Weekly cron uses compact grid to limit API cost */
  weeklyGridProfile: "compact" as GridProfileKey,
  /** Enable 9×9 extended profile (Spectrum / premium tier) */
  extendedGridEnabled: false,
} as const;

export type HeatmapCollectionContext = "audit" | "weekly" | "task_trigger" | "api";

/** Resolve which grid profile to use for a collection context. */
export function gridProfileForCollection(
  context: HeatmapCollectionContext
): GridProfileKey {
  if (context === "weekly") {
    return HEATMAP_FLAGS.weeklyGridProfile;
  }

  if (HEATMAP_FLAGS.extendedGridEnabled) {
    return "extended";
  }

  return HEATMAP_FLAGS.gridProfile;
}
