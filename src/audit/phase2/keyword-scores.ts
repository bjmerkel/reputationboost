import { DEFAULT_ROI_CONFIG } from "../attribution/roi";
import type { KeywordScoreCard, KeywordRankSnapshot, Phase1AuditPayload } from "../types";
import { keywordSnapshotFromVisibility, aiMentionLabel, formatAiSurface } from "../collectors/ai-visibility/helpers";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";
import type { LearnedScoreModel } from "./score-learning";
import { DEFAULT_LEARNED_SCORE_MODEL, effectiveScoreModel } from "./score-learning";
import { projectKeywordToRank1 } from "./counterfactual";
import {
  detectPackFragility,
  impressionWeightFloor,
  keywordGridCoverageScore,
  keywordImpressionWeight,
  keywordServiceAreaRevenueCaptureScore,
  keywordServiceAreaVisibilityScore,
  matchSearchKeywordImpressions,
  positionClickShare,
  positionVisibilityScore,
  resolveKeywordPosition,
  resolveKeywordPositionAtRadius,
} from "./scoring";
import {
  radiusProfileLabel,
  radiusWeightsForAudit,
  resolveRadiusProfile,
} from "./radius-profiles";
import { relevanceByKeyword } from "./relevance-heuristic";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function positionLabel(position: number | "not_in_pack"): string {
  if (position === "not_in_pack") return "Outside 3-Pack";
  if (position <= 3) return `#${position} in Local 3-Pack`;
  return `#${position}`;
}

function radiusRankLabel(rank: number | "not_in_pack"): string {
  if (rank === "not_in_pack") return "outside pack";
  if (rank <= 3) return `#${rank}`;
  return `#${rank}`;
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

function blendedKeywordClickShare(
  kw: KeywordRankSnapshot,
  audit: Phase1AuditPayload,
  model: LearnedScoreModel | null = DEFAULT_LEARNED_SCORE_MODEL
): number {
  const weights = radiusWeightsForAudit(audit);
  const active = effectiveScoreModel(model);
  let weightedSum = 0;
  let totalWeight = 0;

  for (const miles of RADIAL_RING_MILES) {
    const weight = weights[miles];
    if (weight <= 0) continue;
    const position = resolveKeywordPositionAtRadius(kw, miles);
    weightedSum += weight * positionClickShare(position, active);
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/** Monthly leads from impressions × blended CTR × lead rate (no ACV). */
function estimateKeywordLeads(
  impressions: number,
  kw: KeywordRankSnapshot,
  audit: Phase1AuditPayload,
  model: LearnedScoreModel | null = DEFAULT_LEARNED_SCORE_MODEL
): number | null {
  if (impressions <= 0) return null;
  const clickShare = blendedKeywordClickShare(kw, audit, model) / 100;
  const leads = impressions * clickShare * blendedLeadRate();
  return leads > 0 ? leads : null;
}

function estimateKeywordRevenue(
  impressions: number,
  kw: KeywordRankSnapshot,
  audit: Phase1AuditPayload,
  avgCustomerValue: number | null | undefined,
  model: LearnedScoreModel | null = DEFAULT_LEARNED_SCORE_MODEL
): number | null {
  if (!avgCustomerValue || avgCustomerValue <= 0 || impressions <= 0) return null;
  const leads = estimateKeywordLeads(impressions, kw, audit, model);
  if (leads == null) return null;
  return Math.round(leads * avgCustomerValue);
}

function estimateKeywordRevenueAtRank1(
  impressions: number,
  kw: KeywordRankSnapshot,
  audit: Phase1AuditPayload,
  avgCustomerValue: number | null | undefined,
  model: LearnedScoreModel | null = DEFAULT_LEARNED_SCORE_MODEL
): number | null {
  if (!avgCustomerValue || avgCustomerValue <= 0 || impressions <= 0) return null;
  const rank1Kw = projectKeywordToRank1(kw);
  const leads = estimateKeywordLeads(impressions, rank1Kw, audit, model);
  if (leads == null) return null;
  return Math.round(leads * avgCustomerValue);
}

function suggestedAction(
  keyword: string,
  position: number | "not_in_pack",
  inLocalPack: boolean,
  relevanceRecommendation: string | null,
  packFragile: boolean,
  weakestRadiusMiles: number | null
): string {
  if (relevanceRecommendation) return relevanceRecommendation;
  if (packFragile && weakestRadiusMiles) {
    return `Hold 3-Pack through ${weakestRadiusMiles} mi — posts and reviews mentioning "${keyword}"`;
  }
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
  _currentPosition: number | "not_in_pack"
): number {
  const keywords = audit.rankings.keywords;
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const weights = radiusWeightsForAudit(audit);
  const floor = impressionWeightFloor(searchKeywords);
  let totalWeight = 0;
  let currentSum = 0;
  let rank1Sum = 0;

  for (const kw of keywords) {
    const weight = keywordImpressionWeight(kw.keyword, searchKeywords, floor);
    const posScore = keywordServiceAreaVisibilityScore(kw, weights);
    totalWeight += weight;
    currentSum += posScore * weight;
    if (kw.keyword === keyword) {
      const rank1Kw = projectKeywordToRank1(kw);
      rank1Sum += keywordServiceAreaVisibilityScore(rank1Kw, weights) * weight;
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

function buildRadiusRanks(kw: KeywordRankSnapshot): KeywordScoreCard["radiusRanks"] {
  return RADIAL_RING_MILES.map((distanceMiles) => {
    const rank = resolveKeywordPositionAtRadius(kw, distanceMiles);
    const inLocalPack = typeof rank === "number" && rank <= 3;
    return {
      distanceMiles,
      rank,
      inLocalPack,
      label: radiusRankLabel(rank),
    };
  });
}

export interface KeywordScoreOptions {
  avgCustomerValue?: number | null;
  currency?: string;
  scoreModel?: LearnedScoreModel | null;
}

export function computeKeywordScores(
  audit: Phase1AuditPayload,
  options: KeywordScoreOptions = {}
): KeywordScoreCard[] {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const floor = impressionWeightFloor(searchKeywords);
  const relevanceMap = relevanceByKeyword(audit);
  const model = options.scoreModel ?? DEFAULT_LEARNED_SCORE_MODEL;
  const weights = radiusWeightsForAudit(audit);
  const profileLabel = radiusProfileLabel(resolveRadiusProfile(audit));

  return audit.rankings.keywords
    .map((kw) => {
      const position = resolveKeywordPosition(kw);
      const matchedImpressions = matchSearchKeywordImpressions(kw.keyword, searchKeywords);
      const impressions = matchedImpressions ?? null;
      const relevance = relevanceMap.get(kw.keyword.toLowerCase());
      const fragility = detectPackFragility(kw);

      const visibilityScore = keywordServiceAreaVisibilityScore(kw, weights);
      const revenueCaptureScore = keywordServiceAreaRevenueCaptureScore(kw, weights, model);
      const relevanceScore = relevance?.score ?? 50;
      const estimatedMonthlyLeads = impressions
        ? estimateKeywordLeads(impressions, kw, audit, model)
        : null;
      const estimatedMonthlyRevenue = impressions
        ? estimateKeywordRevenue(impressions, kw, audit, options.avgCustomerValue, model)
        : null;
      const potentialAtRank1 = impressions
        ? estimateKeywordRevenueAtRank1(impressions, kw, audit, options.avgCustomerValue, model)
        : null;
      const aiKeyword = keywordSnapshotFromVisibility(audit.aiVisibility, kw.keyword);
      const aiSurfacesMentioned = (aiKeyword?.surfaces ?? [])
        .filter((surface) => surface.mentioned)
        .map((surface) => formatAiSurface(surface.surface));

      return {
        keyword: kw.keyword,
        visibilityScore,
        revenueCaptureScore,
        relevanceScore,
        position,
        positionLabel: positionLabel(position),
        inLocalPack: kw.inLocalPack,
        impressions,
        impressionsLabel: impressionsLabel(impressions),
        estimatedMonthlyRevenue,
        estimatedMonthlyLeads,
        potentialAtRank1,
        scoreImpactIfRank1: overallImpactIfRank1(audit, kw.keyword, position),
        suggestedAction: suggestedAction(
          kw.keyword,
          position,
          kw.inLocalPack,
          relevance?.recommendation ?? null,
          fragility.fragile,
          fragility.weakestRadiusMiles
        ),
        gridCoveragePercent:
          kw.geoGrid && kw.geoGrid.length > 0 ? keywordGridCoverageScore(kw) : null,
        radiusRanks: buildRadiusRanks(kw),
        radiusProfileLabel: profileLabel,
        packFragile: fragility.fragile,
        weakestRadiusMiles: fragility.weakestRadiusMiles,
        aiVisibilityScore: aiKeyword?.score ?? null,
        aiMentionLabel: aiKeyword
          ? aiMentionLabel(aiKeyword.score, aiKeyword.mentionRate)
          : null,
        aiSurfacesMentioned,
      };
    })
    .sort((a, b) => {
      const weightA = a.impressions ?? floor;
      const weightB = b.impressions ?? floor;
      const oppA = (100 - a.visibilityScore) * weightA;
      const oppB = (100 - b.visibilityScore) * weightB;
      return oppB - oppA;
    });
}
