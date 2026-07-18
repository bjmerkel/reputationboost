export interface PerformanceTotals {
  calls: number;
  direction_requests: number;
  website_clicks: number;
  impressions_maps: number;
  impressions_search: number;
}

export interface EngagementDeltas {
  calls: number;
  directions: number;
  websiteClicks: number;
  impressions: number;
}

export interface RankAttribution {
  rankBefore: number | null;
  rankAfter: number | null;
  rankDelta: number | null;
  keywordsImproved: number;
}

export interface AttributionCreditResult {
  engagement: EngagementDeltas;
  rank: RankAttribution;
  overlapCount: number;
  attributionWeight: number;
  rankAttributionWeight: number;
  engagementAttributionWeight: number;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Post-publish observation windows overlap when both tasks are measured concurrently. */
export function postWindowsOverlap(
  aPublishedAt: Date,
  bPublishedAt: Date,
  windowDays: number
): boolean {
  const aStart = aPublishedAt.getTime();
  const aEnd = addDays(aPublishedAt, windowDays).getTime();
  const bStart = bPublishedAt.getTime();
  const bEnd = addDays(bPublishedAt, windowDays).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function countOverlappingPostWindows(
  publishedAt: Date,
  windowDays: number,
  peers: Array<{ publishedAt: string; taskId: string }>,
  selfTaskId: string
): number {
  let count = 1;
  for (const peer of peers) {
    if (peer.taskId === selfTaskId) continue;
    if (postWindowsOverlap(publishedAt, new Date(peer.publishedAt), windowDays)) {
      count += 1;
    }
  }
  return count;
}

export function attributionWeightFromOverlap(overlapCount: number): number {
  if (overlapCount <= 1) return 1;
  return 1 / overlapCount;
}

/**
 * Remove prior-period organic trend from raw before/after engagement deltas.
 * Compares the immediate pre window to the same-length window four weeks earlier.
 */
export function seasonallyAdjustedEngagementDeltas(
  pre: PerformanceTotals,
  post: PerformanceTotals,
  priorBaseline: PerformanceTotals
): EngagementDeltas {
  const trendCalls = pre.calls - priorBaseline.calls;
  const trendDirections = pre.direction_requests - priorBaseline.direction_requests;
  const trendWebsite = pre.website_clicks - priorBaseline.website_clicks;
  const preImpressions = pre.impressions_maps + pre.impressions_search;
  const postImpressions = post.impressions_maps + post.impressions_search;
  const priorImpressions = priorBaseline.impressions_maps + priorBaseline.impressions_search;
  const trendImpressions = preImpressions - priorImpressions;

  return {
    calls: post.calls - pre.calls - trendCalls,
    directions: post.direction_requests - pre.direction_requests - trendDirections,
    websiteClicks: post.website_clicks - pre.website_clicks - trendWebsite,
    impressions: postImpressions - preImpressions - trendImpressions,
  };
}

export function applyEngagementAttributionWeight(
  deltas: EngagementDeltas,
  engagementWeight: number
): EngagementDeltas {
  if (engagementWeight >= 1) return deltas;
  return {
    calls: Math.round(deltas.calls * engagementWeight),
    directions: Math.round(deltas.directions * engagementWeight),
    websiteClicks: Math.round(deltas.websiteClicks * engagementWeight),
    impressions: Math.round(deltas.impressions * engagementWeight),
  };
}

/** Conversion-only tasks should not claim rank movement in attribution. */
export function isolateRankAttribution(
  rank: RankAttribution,
  canAffectRank: boolean,
  rankWeight: number
): RankAttribution {
  if (!canAffectRank) {
    return {
      rankBefore: null,
      rankAfter: null,
      rankDelta: null,
      keywordsImproved: 0,
    };
  }

  const keywordsImproved =
    rankWeight >= 1 ? rank.keywordsImproved : Math.round(rank.keywordsImproved * rankWeight);

  if (
    rank.rankBefore == null ||
    rank.rankAfter == null ||
    rankWeight >= 1
  ) {
    return { ...rank, keywordsImproved };
  }

  const improvement = rank.rankBefore - rank.rankAfter;
  if (improvement <= 0) {
    return { ...rank, keywordsImproved };
  }

  const creditedImprovement = Math.max(0, Math.round(improvement * rankWeight));
  const creditedRankAfter = rank.rankBefore - creditedImprovement;
  return {
    rankBefore: rank.rankBefore,
    rankAfter: creditedRankAfter,
    rankDelta: creditedRankAfter - rank.rankBefore,
    keywordsImproved,
  };
}

export function applyAttributionCredit(params: {
  pre: PerformanceTotals;
  post: PerformanceTotals;
  priorBaseline: PerformanceTotals;
  rank: RankAttribution;
  overlapCount: number;
  canAffectRank: boolean;
}): AttributionCreditResult {
  const attributionWeight = attributionWeightFromOverlap(params.overlapCount);
  const engagementAttributionWeight = attributionWeight;
  const rankAttributionWeight = params.canAffectRank ? attributionWeight : 0;

  const adjustedEngagement = seasonallyAdjustedEngagementDeltas(
    params.pre,
    params.post,
    params.priorBaseline
  );
  const engagement = applyEngagementAttributionWeight(
    adjustedEngagement,
    engagementAttributionWeight
  );
  const rank = isolateRankAttribution(params.rank, params.canAffectRank, rankAttributionWeight);

  return {
    engagement,
    rank,
    overlapCount: params.overlapCount,
    attributionWeight,
    rankAttributionWeight,
    engagementAttributionWeight,
  };
}

export function formatAttributionCreditNote(
  overlapCount: number,
  canAffectRank: boolean
): string | null {
  const parts: string[] = [];
  if (overlapCount > 1) {
    parts.push(`credit shared across ${overlapCount} concurrent actions`);
  }
  if (!canAffectRank) {
    parts.push("rank excluded (conversion-only action)");
  }
  if (parts.length === 0) return null;
  return ` · ${parts.join(" · ")}`;
}
