import type {
  HealthGrade,
  HealthScores,
  KeywordRankSnapshot,
  LocalPackPosition,
  Phase1AuditPayload,
  ScoreComponent,
  ScoreInsight,
} from "../types";
import { resolveKeywordRelevance } from "./relevance-heuristic";
import type { ClickShareCurve, LearnedScoreModel } from "./score-learning";
import {
  computeOverallFromDriverOutcome,
  computeOutcomeIndex,
} from "./score-driver-outcome";
import {
  DEFAULT_CLICK_SHARE_CURVE,
  DEFAULT_LEARNED_SCORE_MODEL,
  effectiveScoreModel,
  topClickSharePercent,
} from "./score-learning";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function gradeFromScore(overall: number): HealthGrade {
  if (overall >= 70) return "healthy";
  if (overall >= 40) return "at_risk";
  return "urgent";
}

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/** Rank position → visibility points (deeper ranks decay smoothly). */
export function positionVisibilityScore(position: LocalPackPosition | number): number {
  if (position === 1) return 100;
  if (position === 2) return 75;
  if (position === 3) return 50;
  if (position === "not_in_pack") return 0;
  if (typeof position === "number") {
    if (position <= 3) return positionVisibilityScore(position as 1 | 2 | 3);
    return clamp(100 - (position - 3) * 12);
  }
  return 0;
}

/** Estimated click-share % by pack position (learned or industry default). */
export function resolveClickSharePercent(
  position: LocalPackPosition | number,
  curve: ClickShareCurve = DEFAULT_CLICK_SHARE_CURVE
): number {
  if (position === 1) return curve.pack1;
  if (position === 2) return curve.pack2;
  if (position === 3) return curve.pack3;
  if (position === "not_in_pack") return curve.outsidePack;
  if (typeof position === "number") {
    if (position <= 3) return resolveClickSharePercent(position as 1 | 2 | 3, curve);
    if (position > 10) return curve.deepOutside;
    return clamp(10 - (position - 4) * 1.5);
  }
  return curve.outsidePack;
}

export function positionClickShare(
  position: LocalPackPosition | number,
  model?: LearnedScoreModel | null
): number {
  return resolveClickSharePercent(position, effectiveScoreModel(model).clickShare);
}

export function resolveKeywordPosition(kw: KeywordRankSnapshot): LocalPackPosition | number {
  if (kw.inLocalPack && typeof kw.localPackPosition === "number") {
    return kw.localPackPosition;
  }
  if (kw.inLocalPack) {
    const rank1mi = kw.geoRanks.find((g) => g.distanceMiles === 1)?.rank;
    if (rank1mi != null && rank1mi <= 3) return rank1mi as 1 | 2 | 3;
  }
  if (typeof kw.localPackPosition === "number") return kw.localPackPosition;
  const rank1mi = kw.geoRanks.find((g) => g.distanceMiles === 1)?.rank;
  return rank1mi ?? "not_in_pack";
}

function resolvePosition(kw: KeywordRankSnapshot): LocalPackPosition | number {
  return resolveKeywordPosition(kw);
}

/** Median impression count across GBP search terms — floor for unmatched tracked keywords. */
export function impressionWeightFloor(
  searchKeywords: Array<{ keyword: string; impressions: number | null }>
): number {
  const matched = searchKeywords
    .map((sk) => sk.impressions)
    .filter((n): n is number => n != null && n > 0)
    .sort((a, b) => a - b);
  if (matched.length === 0) return 1;
  const mid = Math.floor(matched.length / 2);
  return matched.length % 2 === 0
    ? Math.round((matched[mid - 1] + matched[mid]) / 2)
    : matched[mid];
}

/** Best GBP search-term match for a tracked keyword (exact > longest overlap). */
export function matchSearchKeywordImpressions(
  keyword: string,
  searchKeywords: Array<{ keyword: string; impressions: number | null }>
): number | null {
  const lower = keyword.toLowerCase();
  let bestQuality = -1;
  let bestImpressions: number | null = null;

  for (const sk of searchKeywords) {
    const skLower = sk.keyword.toLowerCase();
    if (sk.impressions == null || sk.impressions <= 0) continue;

    let quality: number;
    if (skLower === lower) {
      quality = 10_000 + skLower.length;
    } else if (lower.includes(skLower)) {
      quality = skLower.length;
    } else if (skLower.includes(lower)) {
      quality = lower.length;
    } else {
      continue;
    }

    if (quality > bestQuality) {
      bestQuality = quality;
      bestImpressions = sk.impressions;
    }
  }

  return bestImpressions;
}

export function keywordImpressionWeight(
  keyword: string,
  searchKeywords: Array<{ keyword: string; impressions: number | null }>,
  floor?: number
): number {
  const matched = matchSearchKeywordImpressions(keyword, searchKeywords);
  if (matched != null) return matched;
  return floor ?? impressionWeightFloor(searchKeywords);
}

/** Share of geo-grid points in the Local 3-Pack (0–100). Falls back to 1mi rank position. */
export function keywordGeoGridVisibilityScore(kw: KeywordRankSnapshot): number {
  if (kw.geoGrid && kw.geoGrid.length > 0) {
    const inPack = kw.geoGrid.filter((p) => p.inLocalPack).length;
    return clamp((inPack / kw.geoGrid.length) * 100);
  }
  return positionVisibilityScore(resolveKeywordPosition(kw));
}

function weightedKeywordMetric(
  keywords: KeywordRankSnapshot[],
  searchKeywords: Array<{ keyword: string; impressions: number | null }>,
  metric: (position: LocalPackPosition | number) => number
): number {
  if (keywords.length === 0) return 0;

  const floor = impressionWeightFloor(searchKeywords);
  let totalWeight = 0;
  let weightedSum = 0;

  for (const kw of keywords) {
    const weight = keywordImpressionWeight(kw.keyword, searchKeywords, floor);
    const position = resolvePosition(kw);
    totalWeight += weight;
    weightedSum += metric(position) * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function clickShareMetric(model?: LearnedScoreModel | null) {
  const active = effectiveScoreModel(model);
  return (position: LocalPackPosition | number) => positionClickShare(position, active);
}

function weightedKeywordVisibility(
  keywords: KeywordRankSnapshot[],
  searchKeywords: Array<{ keyword: string; impressions: number | null }>
): number {
  if (keywords.length === 0) return 0;

  const floor = impressionWeightFloor(searchKeywords);
  let totalWeight = 0;
  let weightedSum = 0;

  for (const kw of keywords) {
    const weight = keywordImpressionWeight(kw.keyword, searchKeywords, floor);
    totalWeight += weight;
    weightedSum += keywordGeoGridVisibilityScore(kw) * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export function computeVisibilityScore(audit: Phase1AuditPayload): number {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const base = weightedKeywordVisibility(audit.rankings.keywords, searchKeywords);
  const perfCoverage = audit.gbp.performance.coverage;
  if (!perfCoverage) return clamp(base);

  // Modest confidence adjustment from Performance API data quality (±5 pts).
  const qualityBoost = (perfCoverage.coverageScore - 50) * 0.1;
  const keywordPenalty =
    perfCoverage.apiAvailable && !perfCoverage.hasSearchKeywords ? -3 : 0;
  return clamp(base + qualityBoost + keywordPenalty);
}

export function computeKeywordRelevanceScore(audit: Phase1AuditPayload): number {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const floor = impressionWeightFloor(searchKeywords);
  const byKeyword = new Map(
    resolveKeywordRelevance(audit).map((r) => [r.keyword.toLowerCase(), r])
  );

  let totalWeight = 0;
  let weightedSum = 0;

  for (const kw of audit.rankings.keywords) {
    const weight = keywordImpressionWeight(kw.keyword, searchKeywords, floor);
    const relevance = byKeyword.get(kw.keyword.toLowerCase());
    totalWeight += weight;
    weightedSum += (relevance?.score ?? 50) * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export function computeConversionScore(audit: Phase1AuditPayload): number {
  const { gbp, reviews } = audit;

  const avgLeaderReviews =
    audit.rankings.keywords.reduce((s, k) => s + k.packLeaderReviewCount, 0) /
    Math.max(audit.rankings.keywords.length, 1);
  const ratingScore = clamp(((gbp.engagement.averageRating - 3.5) / 1.5) * 100);
  const volumeRatio = gbp.engagement.reviewCount / Math.max(avgLeaderReviews, 1);
  const reviewStrength = clamp(ratingScore * 0.5 + Math.min(volumeRatio, 1) * 50);

  const completeness = gbp.completeness.completenessScore;
  const photoCountScore = clamp((gbp.content.photoCount / 60) * 100);
  const coverageScore = gbp.content.mediaCoverage?.coverageScore ?? photoCountScore;
  const engagementScore = gbp.content.mediaCoverage?.engagementScore ?? 50;
  const photoScore = clamp(photoCountScore * 0.5 + coverageScore * 0.35 + engagementScore * 0.15);
  const videoScore = clamp((gbp.content.videoCount / 2) * 100);

  const daysSincePost = daysSince(gbp.content.lastPostDate);
  let postScore =
    daysSincePost <= 7 ? 100 : daysSincePost <= 14 ? 70 : daysSincePost <= 30 ? 40 : 10;
  const localPosts = gbp.localPosts;
  if (localPosts?.apiAvailable) {
    const cadenceScore =
      localPosts.daysSinceLastPost == null
        ? 10
        : localPosts.daysSinceLastPost <= 7
          ? 100
          : localPosts.daysSinceLastPost <= 14
            ? 70
            : localPosts.daysSinceLastPost <= 30
              ? 40
              : 10;
    postScore = clamp(
      postScore * 0.55 + localPosts.coverageScore * 0.25 + cadenceScore * 0.2
    );
    if (
      localPosts.livePostCount > 0 &&
      !localPosts.hasCallToActionPosts &&
      !localPosts.hasOfferPost
    ) {
      postScore -= 8;
    }
  }

  let responseScore = clamp(gbp.engagement.responseRate * 100);
  const reviewCoverage = reviews.coverage ?? gbp.reviewCoverage;
  if (reviewCoverage?.apiAvailable) {
    responseScore = clamp(
      responseScore * 0.6 +
        reviewCoverage.responseRate * 100 * 0.25 +
        reviewCoverage.coverageScore * 0.15
    );
    if (reviewCoverage.rejectedReplies > 0) {
      responseScore -= Math.min(10, reviewCoverage.rejectedReplies * 5);
    }
    if (reviewCoverage.pendingReplies > 0) {
      responseScore -= Math.min(5, reviewCoverage.pendingReplies * 2);
    }
  }

  const qaScore =
    gbp.content.unansweredQa === 0 ? 100 : clamp(100 - gbp.content.unansweredQa * 15);

  const placeActionScore = gbp.placeActions?.apiAvailable
    ? clamp(gbp.placeActions.coverageScore)
    : 50;
  const notificationScore =
    gbp.notifications != null ? clamp(gbp.notifications.coverageScore) : 50;

  let profileTrust =
    reviewStrength * 0.32 +
    completeness * 0.18 +
    photoScore * 0.12 +
    videoScore * 0.05 +
    postScore * 0.11 +
    responseScore * 0.09 +
    qaScore * 0.05 +
    placeActionScore * 0.05 +
    notificationScore * 0.03;

  if (reviews.unrespondedNegative > 0) {
    profileTrust -= Math.min(15, reviews.unrespondedNegative * 8);
  }

  const relevance = computeKeywordRelevanceScore(audit);
  return clamp(profileTrust * 0.55 + relevance * 0.45);
}

/** Share of available map clicks captured, weighted by keyword impressions. */
export function computeRevenueCaptureScore(
  audit: Phase1AuditPayload,
  model: LearnedScoreModel | null = DEFAULT_LEARNED_SCORE_MODEL
): number {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const capture = weightedKeywordMetric(
    audit.rankings.keywords,
    searchKeywords,
    clickShareMetric(model)
  );
  const topShare = topClickSharePercent(model);
  return clamp((capture / topShare) * 100);
}

export function findTopOpportunityKeyword(audit: Phase1AuditPayload): string | null {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const floor = impressionWeightFloor(searchKeywords);
  let bestKeyword: string | null = null;
  let bestOpportunity = 0;

  for (const kw of audit.rankings.keywords) {
    const weight = keywordImpressionWeight(kw.keyword, searchKeywords, floor);
    const visibility = keywordGeoGridVisibilityScore(kw);
    const opportunity = (100 - visibility) * weight;
    if (opportunity > bestOpportunity) {
      bestOpportunity = opportunity;
      bestKeyword = kw.keyword;
    }
  }

  return bestKeyword;
}

export function buildScoreInsight(
  audit: Phase1AuditPayload,
  driverScore: number,
  outcomeIndex: number,
  visibility: number,
  conversion: number,
  revenueCapture: number
): ScoreInsight {
  const components: Array<{ id: ScoreComponent; score: number }> = [
    { id: "driver", score: driverScore },
    { id: "outcome", score: outcomeIndex },
    { id: "visibility", score: visibility },
    { id: "conversion", score: conversion },
    { id: "revenueCapture", score: revenueCapture },
  ];
  components.sort((a, b) => a.score - b.score);
  const weakest = components[0];

  const topOpportunityKeyword = findTopOpportunityKeyword(audit);

  let nextAction: string | null = null;
  if (weakest.id === "driver" || weakest.id === "conversion") {
    const relevance = resolveKeywordRelevance(audit)
      .filter((r) => r.score < 60)
      .sort((a, b) => a.score - b.score)[0];
    if (relevance?.recommendation) {
      nextAction = relevance.recommendation;
    } else if (audit.reviews.unrespondedNegative > 0) {
      nextAction = `Respond to ${audit.reviews.unrespondedNegative} negative review(s) to boost click-through`;
    } else if (audit.gbp.engagement.responseRate < 0.85) {
      nextAction = "Raise review response rate above 85%";
    } else if (daysSince(audit.gbp.content.lastPostDate) > 14) {
      nextAction = "Publish a Google Post — profile looks inactive";
    } else {
      nextAction = "Add photos and strengthen reviews to win more clicks in the pack";
    }
  } else if (weakest.id === "outcome" || weakest.id === "visibility" || weakest.id === "revenueCapture") {
    if (topOpportunityKeyword) {
      const kw = audit.rankings.keywords.find((k) => k.keyword === topOpportunityKeyword);
      const pos = kw ? resolvePosition(kw) : "not_in_pack";
      const posLabel = pos === "not_in_pack" ? "outside the 3-Pack" : `#${pos}`;
      nextAction = `Ranking outcome: improve "${topOpportunityKeyword}" (${posLabel}) — strengthen profile relevance first`;
    } else {
      nextAction = "Ranking outcome is lagging — align categories and services with target keywords";
    }
  } else {
    nextAction = topOpportunityKeyword
      ? `Move "${topOpportunityKeyword}" into the top 3 to capture more map clicks`
      : "Enter the Local 3-Pack on more target keywords";
  }

  return {
    weakestComponent: weakest.id === "driver" || weakest.id === "conversion" ? "conversion" : weakest.id === "outcome" ? "visibility" : weakest.id,
    topOpportunityKeyword,
    nextAction,
  };
}

/** Outcome metrics — shown separately, not blended into listing strength. */
export function computeEngagementOutcomes(audit: Phase1AuditPayload): {
  calls: number;
  directions: number;
  websiteClicks: number;
  profileViews: number;
} {
  const perf = audit.gbp.performance;
  return {
    calls: perf.calls,
    directions: perf.directionRequests,
    websiteClicks: perf.websiteClicks,
    profileViews: perf.profileViews,
  };
}

export function computeHealthScores(
  audit: Phase1AuditPayload,
  model: LearnedScoreModel | null = DEFAULT_LEARNED_SCORE_MODEL
): HealthScores {
  const active = effectiveScoreModel(model);
  const visibility = computeVisibilityScore(audit);
  const conversion = computeConversionScore(audit);
  const revenueCapture = computeRevenueCaptureScore(audit, active);

  const driverScore = conversion;
  const outcomeIndex = computeOutcomeIndex(visibility, revenueCapture);
  const overall = computeOverallFromDriverOutcome(driverScore, outcomeIndex);

  const outsidePack = audit.rankings.keywords.filter((k) => !k.inLocalPack);
  let competitiveGap = 100;
  if (outsidePack.length > 0) {
    const avgGap =
      outsidePack.reduce((s, k) => {
        const pos = typeof k.localPackPosition === "number" ? k.localPackPosition : 10;
        return s + Math.max(0, pos - 3);
      }, 0) / outsidePack.length;
    competitiveGap = clamp(100 - avgGap * 12);
  }

  const avgLeaderReviews =
    audit.rankings.keywords.reduce((s, k) => s + k.packLeaderReviewCount, 0) /
    Math.max(audit.rankings.keywords.length, 1);
  const ratingScore = clamp(((audit.gbp.engagement.averageRating - 3.5) / 1.5) * 100);
  const volumeRatio = audit.gbp.engagement.reviewCount / Math.max(avgLeaderReviews, 1);
  const reviewStrength = clamp(ratingScore * 0.5 + Math.min(volumeRatio, 1) * 50);

  const outcomes = computeEngagementOutcomes(audit);

  return {
    overall,
    grade: gradeFromScore(overall),
    driverScore,
    outcomeIndex,
    visibility,
    conversion,
    revenueCapture,
    insight: buildScoreInsight(
      audit,
      driverScore,
      outcomeIndex,
      visibility,
      conversion,
      revenueCapture
    ),
    // Legacy fields for stored audits and LLM context
    gbpCompleteness: audit.gbp.completeness.completenessScore,
    localPackCoverage: audit.rankings.shareOfVoice,
    reviewStrength,
    engagement: outcomes.profileViews + outcomes.calls + outcomes.directions + outcomes.websiteClicks,
    competitiveGap,
    engagementOutcomes: outcomes,
  };
}
