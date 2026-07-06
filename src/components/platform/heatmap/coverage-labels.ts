import type { VisibilitySummary } from "@/audit/geo/types";

/** Plain-language labels for geo-grid / Local Pack coverage metrics. */
export function formatCoverageDisplay(summary: Pick<
  VisibilitySummary,
  "coveragePercent" | "cellsInPack" | "cellsTotal" | "hasGridData"
>) {
  if (summary.hasGridData && summary.cellsTotal > 0) {
    return {
      headline: `Top 3 in ${summary.cellsInPack} of ${summary.cellsTotal} areas`,
      subline: "When people search your keyword nearby",
      compact: `${summary.cellsInPack}/${summary.cellsTotal} in top 3`,
      statLabel: "Top 3 areas",
      statValue: `${summary.cellsInPack}/${summary.cellsTotal}`,
    };
  }

  return {
    headline: `~${summary.coveragePercent}% local visibility`,
    subline: "Estimated share of nearby searches where you appear",
    compact: `${summary.coveragePercent}% visible`,
    statLabel: "Visibility",
    statValue: `${summary.coveragePercent}%`,
  };
}

export function formatAvgCoverageLabel(avgCoverage: number): string {
  return `In Google's top 3 for ${avgCoverage}% of areas on average`;
}
