/** Feature flags for geo-grid heatmap rollout (Pillars 1–3). */
export const HEATMAP_FLAGS = {
  insightPanel: true,
  zoneHighlights: true,
  gridDiff: false,
  heatmapLayer: false,
  competitorDominance: false,
  gridProfile: "compact" as "compact" | "standard" | "extended",
} as const;
