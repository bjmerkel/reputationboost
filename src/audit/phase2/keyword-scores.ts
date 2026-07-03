import { DEFAULT_ROI_CONFIG } from "../attribution/roi";
import type { KeywordScoreCard, Phase1AuditPayload } from "../types";
import {
  keywordImpressionWeight,
  positionClickShare,
  positionVisibilityScore,
  resolveKeywordPosition,
} from "./scoring";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function positionLabel(position: number | "not_in_pack"): string {
  if (position === "not_in_pack") return "Outside 3-Pack";
  if (position <= 3) return `#${position} in Local 3-Pack`;
  return `#${position}`;
}

function impressionsLabel(impressions: number | null): string {
  if (impressions == null || impressions <= 0) return "No impression data";
  return `${impressions.toLocaleString()} impressions/mo`;
}

/** Blended lead rate from map engagement actions. */
function blendedLeadRate(): number {
  const c = DEFAULT_ROI_CONFIG;
  return (c.callConversionRate + c.directionConversionRate + c.websiteClickConversionRate) / 3;
}

function estimateKeywordRevenue(
  impressions: number,
  position: number | "not_in_pack",
  avgCustomerValue: number | null | undefined
): number | null {
  if (!avgCustomerValue || avgCustomerValue <= 0 || impressions <= 0) return null;
  const clickShare = positionClickShare(position) / 100;
  const leads = impressions * clickShare * blendedLeadRate();
  return Math.round(leads * avgCustomerValue);
}

function suggestedAction(
  keyword: string,
  position: number | "not_in_pack",
  inLocalPack: boolean
): string {
  if (!inLocalPack) {
    return `2 Google Posts + 5 reviews mentioning "${keyword}"`;
  }
  if (position === 3) {
    return `Strengthen reviews and photos to move from #3 to #1`;
  }
  if (position === 2) {
    return `Publish weekly posts targeting "${keyword}"`;
  }
  return `Maintain #1 with fresh posts and review responses`;
}

function overallImpactIfRank1(
  audit: Phase1AuditPayload,
  keyword: string,
  currentPosition: number | "not_in_pack"
): number {
  const keywords = audit.rankings.keywords;
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  let totalWeight = 0;
  let currentSum = 0;
  let rank1Sum = 0;

  for (const kw of keywords) {
    const weight = keywordImpressionWeight(kw.keyword, searchKeywords);
    const pos = resolveKeywordPosition(kw);
    const posScore = positionVisibilityScore(pos);
    const rank1Score = positionVisibilityScore(1);
    totalWeight += weight;
    currentSum += posScore * weight;
    if (kw.keyword === keyword) {
      rank1Sum += rank1Score * weight;
    } else {
      rank1Sum += posScore * weight;
    }
  }

  if (totalWeight <= 0) return 0;
  const currentVisibility = currentSum / totalWeight;
  const rank1Visibility = rank1Sum / totalWeight;
  const visibilityDelta = rank1Visibility - currentVisibility;
  return clamp(visibilityDelta * 0.5);
}

export interface KeywordScoreOptions {
  avgCustomerValue?: number | null;
  currency?: string;
}

export function computeKeywordScores(
  audit: Phase1AuditPayload,
  options: KeywordScoreOptions = {}
): KeywordScoreCard[] {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];

  return audit.rankings.keywords
    .map((kw) => {
      const position = resolveKeywordPosition(kw);
      const impressionsRaw = keywordImpressionWeight(kw.keyword, searchKeywords);
      const hasRealImpressions = searchKeywords.some((sk) => {
        const lower = kw.keyword.toLowerCase();
        const skLower = sk.keyword.toLowerCase();
        return (
          (skLower === lower || lower.includes(skLower) || skLower.includes(lower)) &&
          sk.impressions != null &&
          sk.impressions > 0
        );
      });
      const impressions = hasRealImpressions ? impressionsRaw : null;

      const visibilityScore = positionVisibilityScore(position);
      const revenueCaptureScore = clamp((positionClickShare(position) / 45) * 100);
      const estimatedMonthlyRevenue = impressions
        ? estimateKeywordRevenue(impressions, position, options.avgCustomerValue)
        : null;
      const potentialAtRank1 = impressions
        ? estimateKeywordRevenue(impressions, 1, options.avgCustomerValue)
        : null;

      return {
        keyword: kw.keyword,
        visibilityScore,
        revenueCaptureScore,
        position,
        positionLabel: positionLabel(position),
        inLocalPack: kw.inLocalPack,
        impressions,
        impressionsLabel: impressionsLabel(impressions),
        estimatedMonthlyRevenue,
        potentialAtRank1,
        scoreImpactIfRank1: overallImpactIfRank1(audit, kw.keyword, position),
        suggestedAction: suggestedAction(kw.keyword, position, kw.inLocalPack),
      };
    })
    .sort((a, b) => {
      const oppA = (100 - a.visibilityScore) * (a.impressions ?? 1);
      const oppB = (100 - b.visibilityScore) * (b.impressions ?? 1);
      return oppB - oppA;
    });
}
