import type { ExecutionTask, GapFlag, KeywordRankSnapshot } from "@/audit/types";
import { keywordGeoGridVisibilityScore } from "@/audit/phase2/scoring";
import type { LearnedScoreModel } from "@/audit/phase2/score-learning";
import { analyzeGeoZones, weakZones } from "./zone-analyzer";
import { enrichZonesWithRevenue } from "./zone-revenue";
import { mapZoneActions } from "./zone-task-mapper";
import type { VisibilitySummary } from "./types";

export interface BuildVisibilitySummaryInput {
  keywordRank: KeywordRankSnapshot;
  searchKeywords?: Array<{ keyword: string; impressions: number | null }>;
  avgCustomerValue?: number | null;
  gaps?: GapFlag[];
  tasks?: ExecutionTask[];
  scoreModel?: LearnedScoreModel | null;
}

/** Build full visibility summary for map insight panel. */
export function buildVisibilitySummary(input: BuildVisibilitySummaryInput): VisibilitySummary {
  const { keywordRank, searchKeywords = [], avgCustomerValue, gaps = [], tasks = [], scoreModel } =
    input;
  const grid = keywordRank.geoGrid ?? [];
  const hasGridData = grid.length > 0;

  if (!hasGridData) {
    const coveragePercent = keywordGeoGridVisibilityScore(keywordRank);
    return {
      keyword: keywordRank.keyword,
      coveragePercent,
      cellsTotal: 0,
      cellsInPack: 0,
      cellsWeak: 0,
      cellsCritical: 0,
      zones: [],
      totalRevenueAtRisk: null,
      totalUpsideAtRank1: null,
      hasGridData: false,
    };
  }

  const cellsInPack = grid.filter((c) => c.inLocalPack).length;
  const cellsWeak = grid.filter((c) => c.rank !== null && c.rank > 10).length;
  const cellsCritical = grid.filter((c) => c.rank === null).length;
  const coveragePercent = keywordGeoGridVisibilityScore(keywordRank);

  let zones = analyzeGeoZones(grid);
  const revenue = enrichZonesWithRevenue(
    zones,
    grid.length,
    keywordRank.keyword,
    searchKeywords,
    avgCustomerValue,
    scoreModel
  );
  zones = mapZoneActions(revenue.zones, keywordRank.keyword, gaps, tasks);

  // Re-order: weak zones first for panel display
  const weak = weakZones(zones);
  const strong = zones.filter((z) => z.severity === "strong" || z.severity === "moderate");
  const orderedZones = [...weak, ...strong.filter((z) => !weak.includes(z))];

  return {
    keyword: keywordRank.keyword,
    coveragePercent,
    cellsTotal: grid.length,
    cellsInPack,
    cellsWeak,
    cellsCritical,
    zones: orderedZones,
    totalRevenueAtRisk: revenue.totalRevenueAtRisk,
    totalUpsideAtRank1: revenue.totalUpsideAtRank1,
    hasGridData: true,
  };
}

/** Aggregate pack coverage across all tracked keywords (for home summary). */
export function aggregateGridCoverage(
  keywords: KeywordRankSnapshot[]
): { avgCoverage: number; keywordsWithGrid: number } {
  if (keywords.length === 0) return { avgCoverage: 0, keywordsWithGrid: 0 };

  let sum = 0;
  let withGrid = 0;
  for (const kw of keywords) {
    sum += keywordGeoGridVisibilityScore(kw);
    if (kw.geoGrid && kw.geoGrid.length > 0) withGrid += 1;
  }

  return {
    avgCoverage: Math.round(sum / keywords.length),
    keywordsWithGrid: withGrid,
  };
}
