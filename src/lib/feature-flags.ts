/** Feature flags for geo-grid heatmap rollout (Pillars 1–3). */
export const HEATMAP_FLAGS = {
  insightPanel: true,
  zoneHighlights: true,
  gridDiff: true,
  heatmapLayer: true,
  competitorDominance: true,
  gridProfile: "standard" as "compact" | "standard" | "extended",
} as const;
