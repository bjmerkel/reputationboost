import { DEFAULT_ROI_CONFIG } from "@/audit/attribution/roi";
import type { GeoGridPoint } from "@/audit/types";
import type { LearnedScoreModel } from "@/audit/phase2/score-learning";
import { DEFAULT_LEARNED_SCORE_MODEL } from "@/audit/phase2/score-learning";
import {
  keywordImpressionWeight,
  positionClickShare,
} from "@/audit/phase2/scoring";
import type { GeoZone } from "./types";

function blendedLeadRate(): number {
  const c = DEFAULT_ROI_CONFIG;
  return (c.callConversionRate + c.directionConversionRate + c.websiteClickConversionRate) / 3;
}

function revenueFromImpressions(
  impressions: number,
  clickSharePercent: number,
  avgCustomerValue: number
): number {
  const leads = impressions * (clickSharePercent / 100) * blendedLeadRate();
  return Math.round(leads * avgCustomerValue);
}

function zoneAvgRank(cells: GeoGridPoint[]): number {
  const ranks = cells.map((c) => c.rank).filter((r): r is number => r !== null);
  if (ranks.length === 0) return 15;
  return ranks.reduce((a, b) => a + b, 0) / ranks.length;
}

/** Estimate monthly revenue at risk and upside for one zone. */
export function estimateZoneRevenue(
  zone: GeoZone,
  totalCells: number,
  keywordImpressions: number | null,
  avgCustomerValue: number | null | undefined,
  model: LearnedScoreModel | null = DEFAULT_LEARNED_SCORE_MODEL
): { revenueAtRisk: number | null; upsideAtRank1: number | null } {
  if (!avgCustomerValue || avgCustomerValue <= 0 || !keywordImpressions || keywordImpressions <= 0) {
    return { revenueAtRisk: null, upsideAtRank1: null };
  }

  const zoneShare = zone.cells.length / Math.max(totalCells, 1);
  const zoneImpressions = keywordImpressions * zoneShare;
  const currentRank = zoneAvgRank(zone.cells);
  const currentShare = positionClickShare(Math.round(currentRank), model);
  const rank1Share = positionClickShare(1, model);

  const currentRevenue = revenueFromImpressions(zoneImpressions, currentShare, avgCustomerValue);
  const rank1Revenue = revenueFromImpressions(zoneImpressions, rank1Share, avgCustomerValue);

  const upside = Math.max(0, rank1Revenue - currentRevenue);
  const atRisk = zone.severity === "strong" ? 0 : upside;

  return { revenueAtRisk: atRisk > 0 ? atRisk : null, upsideAtRank1: upside > 0 ? upside : null };
}

/** Attach revenue estimates to zones and compute totals. */
export function enrichZonesWithRevenue(
  zones: GeoZone[],
  totalCells: number,
  keyword: string,
  searchKeywords: Array<{ keyword: string; impressions: number | null }>,
  avgCustomerValue: number | null | undefined,
  model?: LearnedScoreModel | null
): {
  zones: GeoZone[];
  totalRevenueAtRisk: number | null;
  totalUpsideAtRank1: number | null;
} {
  const impressions = keywordImpressionWeight(keyword, searchKeywords);
  let totalAtRisk = 0;
  let totalUpside = 0;
  let hasRisk = false;
  let hasUpside = false;

  const enriched = zones.map((zone) => {
    const { revenueAtRisk, upsideAtRank1 } = estimateZoneRevenue(
      zone,
      totalCells,
      impressions,
      avgCustomerValue,
      model
    );
    if (revenueAtRisk != null) {
      totalAtRisk += revenueAtRisk;
      hasRisk = true;
    }
    if (upsideAtRank1 != null) {
      totalUpside += upsideAtRank1;
      hasUpside = true;
    }
    return { ...zone, revenueAtRisk };
  });

  return {
    zones: enriched,
    totalRevenueAtRisk: hasRisk ? totalAtRisk : null,
    totalUpsideAtRank1: hasUpside ? totalUpside : null,
  };
}
