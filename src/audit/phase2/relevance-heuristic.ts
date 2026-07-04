import { matchKeywordsInText } from "@/audit/attribution/keywords";
import type {
  CompetitorSnapshot,
  KeywordRelevanceFeatures,
  Phase1AuditPayload,
} from "@/audit/types";

function significantTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["near", "best", "local"].includes(w));
}

function textContainsKeyword(text: string, keyword: string): boolean {
  const tokens = significantTokens(keyword);
  const lower = text.toLowerCase();
  if (tokens.length === 0) return lower.includes(keyword.toLowerCase());
  return tokens.some((t) => lower.includes(t));
}

function attributeFitScore(audit: Phase1AuditPayload, keyword: string): number {
  const attrs = (audit.gbp.liveProfile?.attributes ?? []).join(" ").toLowerCase();
  if (!attrs) return 40;

  const tokens = significantTokens(keyword);
  if (tokens.length === 0) return attrs.includes(keyword.toLowerCase()) ? 100 : 40;

  const matched = tokens.filter((t) => attrs.includes(t)).length;
  const ratio = matched / tokens.length;

  if (ratio >= 0.75) return 100;
  if (ratio >= 0.5) return 75;
  if (ratio > 0) return 55;
  return audit.gbp.completeness.attributeCount >= 5 ? 50 : 30;
}

function categoryFitScore(audit: Phase1AuditPayload, keyword: string): number {
  const live = audit.gbp.liveProfile;
  const categories = [
    live?.primaryCategory ?? audit.gbp.identity.primaryCategory,
    ...(live?.secondaryCategories ?? audit.gbp.identity.secondaryCategories),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tokens = significantTokens(keyword);
  if (tokens.length === 0) return 40;

  const matched = tokens.filter((t) => categories.includes(t)).length;
  const ratio = matched / tokens.length;

  if (ratio >= 0.75) return 100;
  if (ratio >= 0.5) return 75;
  if (ratio > 0) return 50;
  return 25;
}

function countReviewMentions(audit: Phase1AuditPayload, keyword: string): number {
  const tokens = significantTokens(keyword);
  if (tokens.length === 0) return 0;

  return audit.reviews.reviews.filter((review) => {
    const lower = review.text.toLowerCase();
    return tokens.some((t) => lower.includes(t));
  }).length;
}

function competitorSnapshotFor(
  audit: Phase1AuditPayload,
  keyword: string
): CompetitorSnapshot | undefined {
  return audit.competitors.find(
    (c) => c.keyword.toLowerCase() === keyword.toLowerCase()
  );
}

function buildCompetitorGaps(
  audit: Phase1AuditPayload,
  keyword: string
): string[] {
  const gaps: string[] = [];
  const snapshot = competitorSnapshotFor(audit, keyword);
  const leader = snapshot?.competitors[0];
  if (!leader) return gaps;

  const ourCategory =
    audit.gbp.liveProfile?.primaryCategory ?? audit.gbp.identity.primaryCategory;

  if (
    leader.primaryCategory &&
    ourCategory &&
    leader.primaryCategory.toLowerCase() !== ourCategory.toLowerCase() &&
    textContainsKeyword(leader.primaryCategory, keyword)
  ) {
    gaps.push(
      `Pack leader uses category "${leader.primaryCategory}" vs your "${ourCategory}"`
    );
  }

  if (leader.reviewCount > audit.gbp.engagement.reviewCount * 1.5) {
    gaps.push(
      `Pack leader has ${leader.reviewCount} reviews vs your ${audit.gbp.engagement.reviewCount}`
    );
  }

  if (leader.photoCount > audit.gbp.content.photoCount + 20) {
    gaps.push(
      `Pack leader has ${leader.photoCount} photos vs your ${audit.gbp.content.photoCount}`
    );
  }

  const leaderThemes = leader.reviewThemes ?? [];
  if (leaderThemes.length > 0) {
    const ourThemes = audit.reviews.sentiment.positiveThemes;
    const missing = leaderThemes.filter(
      (theme) => !ourThemes.some((t) => t.toLowerCase().includes(theme.toLowerCase()))
    );
    if (missing.length > 0) {
      gaps.push(`Review themes pack leaders emphasize: ${missing.slice(0, 3).join(", ")}`);
    }
  }

  return gaps.slice(0, 4);
}

function buildRecommendation(
  keyword: string,
  features: Omit<KeywordRelevanceFeatures, "recommendation" | "source" | "keyword">,
  attributeCount: number
): string | null {
  const actions: string[] = [];

  if (features.categoryFit < 50) {
    actions.push(`consider a category better aligned with "${keyword}"`);
  }
  if (!features.servicesCoverage) {
    actions.push(`add "${keyword}" as a named GBP service`);
  }
  if (!features.descriptionCoverage) {
    actions.push(`weave "${keyword}" into your business description`);
  }
  if (features.reviewMentions < 2) {
    actions.push(`collect reviews mentioning "${keyword}"`);
  }
  if (!features.postCoverage) {
    actions.push(`publish a Google Post targeting "${keyword}"`);
  }
  if (attributeCount < 5) {
    actions.push("enable more GBP business attributes");
  }

  if (actions.length === 0) return null;
  return actions.slice(0, 2).join("; ");
}

function blendRelevanceScore(parts: {
  categoryFit: number;
  attributeFit: number;
  servicesCoverage: boolean;
  descriptionCoverage: boolean;
  reviewMentions: number;
  postCoverage: boolean;
}): number {
  const reviewScore = Math.min(100, parts.reviewMentions * 25);
  return Math.round(
    parts.categoryFit * 0.22 +
      parts.attributeFit * 0.08 +
      (parts.descriptionCoverage ? 100 : 0) * 0.2 +
      (parts.servicesCoverage ? 100 : 0) * 0.25 +
      reviewScore * 0.2 +
      (parts.postCoverage ? 100 : 0) * 0.05
  );
}

/** Deterministic per-keyword relevance features (no LLM). */
export function extractKeywordRelevanceHeuristic(
  audit: Phase1AuditPayload
): KeywordRelevanceFeatures[] {
  const description = audit.gbp.liveProfile?.description ?? "";
  const services = (audit.gbp.liveProfile?.services ?? [])
    .map((s) => `${s.name} ${s.description}`)
    .join(" ");
  const posts = (audit.gbp.recentPosts ?? []).map((p) => p.summary).join(" ");

  return audit.rankings.keywords.map((kw) => {
    const keyword = kw.keyword;
    const categoryFit = categoryFitScore(audit, keyword);
    const attributeFit = attributeFitScore(audit, keyword);
    const descriptionCoverage = textContainsKeyword(description, keyword);
    const servicesCoverage =
      textContainsKeyword(services, keyword) ||
      matchKeywordsInText(services, [keyword]).length > 0;
    const postCoverage = textContainsKeyword(posts, keyword);
    const reviewMentions = countReviewMentions(audit, keyword);
    const competitorGaps = buildCompetitorGaps(audit, keyword);

    const partial = {
      score: 0,
      categoryFit,
      attributeFit,
      servicesCoverage,
      descriptionCoverage,
      reviewMentions,
      postCoverage,
      competitorGaps,
    };
    partial.score = blendRelevanceScore(partial);

    return {
      keyword,
      ...partial,
      recommendation: buildRecommendation(keyword, partial, audit.gbp.completeness.attributeCount),
      source: "heuristic",
    };
  });
}

/** Resolve relevance features — uses cached audit data or computes heuristics. */
export function resolveKeywordRelevance(
  audit: Phase1AuditPayload
): KeywordRelevanceFeatures[] {
  return audit.keywordRelevance ?? extractKeywordRelevanceHeuristic(audit);
}

export function relevanceByKeyword(
  audit: Phase1AuditPayload
): Map<string, KeywordRelevanceFeatures> {
  return new Map(
    resolveKeywordRelevance(audit).map((r) => [r.keyword.toLowerCase(), r])
  );
}
