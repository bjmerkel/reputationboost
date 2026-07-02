import type { HealthGrade, HealthScores, Phase1AuditPayload } from "../types";

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

export function computeHealthScores(audit: Phase1AuditPayload): HealthScores {
  const gbpCompleteness = audit.gbp.completeness.completenessScore;

  const localPackCoverage = audit.rankings.shareOfVoice;

  const avgLeaderReviews =
    audit.rankings.keywords.reduce((s, k) => s + k.packLeaderReviewCount, 0) /
    Math.max(audit.rankings.keywords.length, 1);
  const ratingScore = clamp(((audit.gbp.engagement.averageRating - 3.5) / 1.5) * 100);
  const volumeRatio = audit.gbp.engagement.reviewCount / Math.max(avgLeaderReviews, 1);
  const reviewStrength = clamp(ratingScore * 0.5 + Math.min(volumeRatio, 1) * 50);

  const engagementRaw =
    audit.gbp.performance.calls +
    audit.gbp.performance.directionRequests +
    audit.gbp.performance.websiteClicks;
  const engagement = clamp((engagementRaw / 150) * 100);

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

  const postPenalty = daysSince(audit.gbp.content.lastPostDate) > 14 ? 5 : 0;
  const responsePenalty =
    audit.gbp.engagement.responseRate < 0.8 ? 5 : 0;

  const overall = clamp(
    gbpCompleteness * 0.2 +
      localPackCoverage * 0.3 +
      reviewStrength * 0.2 +
      engagement * 0.15 +
      competitiveGap * 0.15 -
      postPenalty -
      responsePenalty
  );

  return {
    overall,
    grade: gradeFromScore(overall),
    gbpCompleteness,
    localPackCoverage,
    reviewStrength: clamp(reviewStrength),
    engagement,
    competitiveGap,
  };
}
