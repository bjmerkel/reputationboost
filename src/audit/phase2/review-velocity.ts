import type { GapFlag, KeywordRankSnapshot, Phase1AuditPayload } from "../types";
import { detectGaps } from "./gaps";

/** Client review count below this fraction of the pack leader triggers review-velocity gaps. */
export const REVIEW_VELOCITY_LEADER_RATIO = 0.6;

/** Minimum review gap (absolute) when impression data is unavailable. */
export const REVIEW_VELOCITY_MIN_GAP = 20;

export function isReviewVelocityGapId(gapId: string): boolean {
  return gapId.startsWith("review-velocity-");
}

export function keywordFromReviewVelocityGapId(gapId: string): string | null {
  if (!isReviewVelocityGapId(gapId)) return null;
  return gapId.replace("review-velocity-", "");
}

export function medianSearchKeywordImpressions(
  searchKeywords: Array<{ impressions: number | null }>
): number {
  const values = searchKeywords
    .map((row) => row.impressions)
    .filter((value): value is number => value != null && value > 0);
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function keywordReviewGap(kw: KeywordRankSnapshot): number {
  return Math.max(0, kw.packLeaderReviewCount - kw.clientReviewCount);
}

export function keywordImpressions(
  keyword: string,
  searchKeywords: Array<{ keyword: string; impressions: number | null }>
): number {
  const row = searchKeywords.find(
    (item) => item.keyword.toLowerCase() === keyword.toLowerCase()
  );
  return row?.impressions ?? 0;
}

/**
 * Outside-pack keyword where review count is far behind the pack leader and
 * the term has material search demand (when impression data exists).
 */
export function keywordQualifiesForReviewVelocityGap(
  kw: KeywordRankSnapshot,
  searchKeywords: Array<{ keyword: string; impressions: number | null }>
): boolean {
  if (kw.inLocalPack) return false;
  if (kw.packLeaderReviewCount <= 0) return false;

  const reviewGap = keywordReviewGap(kw);
  const ratio = kw.clientReviewCount / kw.packLeaderReviewCount;
  if (ratio >= REVIEW_VELOCITY_LEADER_RATIO) return false;

  const impressions = keywordImpressions(kw.keyword, searchKeywords);
  const median = medianSearchKeywordImpressions(searchKeywords);
  if (median > 0) {
    return impressions >= median;
  }

  return reviewGap >= REVIEW_VELOCITY_MIN_GAP;
}

export function auditPackShare(audit: Phase1AuditPayload): number {
  const total = audit.rankings.totalKeywords || audit.rankings.keywords.length;
  if (total <= 0) return 0;
  return audit.rankings.keywordsInPack / total;
}

export function auditHasReviewVelocityGap(audit: Phase1AuditPayload): boolean {
  return detectGaps(audit).some((gap) => isReviewVelocityGapId(gap.id));
}

/**
 * Outside-pack businesses where review velocity is likely the pack-entry blocker.
 * Suppressed when the profile is already mostly in-pack and needs conversion work.
 */
export function auditNeedsReviewVelocityBoost(audit: Phase1AuditPayload): boolean {
  if (auditPackShare(audit) >= 0.5) return false;
  return auditHasReviewVelocityGap(audit);
}

export function topReviewVelocityGap(audit: Phase1AuditPayload): GapFlag | undefined {
  const gaps = detectGaps(audit).filter((gap) => isReviewVelocityGapId(gap.id));
  return gaps.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))[0];
}

function priorityRank(priority: GapFlag["priority"]): number {
  switch (priority) {
    case "P0":
      return 0;
    case "P1":
      return 1;
    case "P2":
      return 2;
    case "P3":
      return 3;
    default:
      return 9;
  }
}
