import type { FullAuditPayload, Phase1AuditPayload, StrategyReport } from "@/audit/types";

/** Condensed audit payload for LLM prompts — keeps token usage reasonable. */
export function buildAuditContext(audit: Phase1AuditPayload): string {
  const keywords = audit.rankings.keywords.map((k) => ({
    keyword: k.keyword,
    inLocalPack: k.inLocalPack,
    position: k.localPackPosition,
    rank1mi: k.geoRanks.find((g) => g.distanceMiles === 1)?.rank ?? null,
    packLeaderReviews: k.packLeaderReviewCount,
    clientReviews: k.clientReviewCount,
  }));

  const competitors = audit.competitors.slice(0, 3).map((snap) => ({
    keyword: snap.keyword,
    top3: snap.competitors.slice(0, 3).map((c) => ({
      name: c.name,
      rating: c.averageRating,
      reviews: c.reviewCount,
      postsLast30Days: c.postsLast30Days,
    })),
  }));

  const unrespondedReviews = audit.reviews.reviews
    .filter((r) => !r.responded)
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      author: r.author,
      text: r.text.slice(0, 280),
      sentiment: r.sentiment,
    }));

  const payload = {
    business: {
      name: audit.clientName,
      category: audit.gbp.identity.primaryCategory,
      address: audit.gbp.identity.address,
      phone: audit.gbp.identity.phone,
      website: audit.gbp.identity.website,
    },
    rankings: {
      shareOfVoice: audit.rankings.shareOfVoice,
      keywordsInPack: audit.rankings.keywordsInPack,
      totalKeywords: audit.rankings.totalKeywords,
      keywords,
    },
    gbp: {
      completenessScore: audit.gbp.completeness.completenessScore,
      photoCount: audit.gbp.content.photoCount,
      lastPostDate: audit.gbp.content.lastPostDate,
      reviewCount: audit.gbp.engagement.reviewCount,
      averageRating: audit.gbp.engagement.averageRating,
      responseRate: audit.gbp.engagement.responseRate,
      calls30d: audit.gbp.performance.calls,
      directions30d: audit.gbp.performance.directionRequests,
    },
    reviews: {
      positiveThemes: audit.reviews.sentiment.positiveThemes,
      negativeThemes: audit.reviews.sentiment.negativeThemes,
      unrespondedNegative: audit.reviews.unrespondedNegative,
      unrespondedReviews,
    },
    competitors,
    offGoogle: {
      citationScore: audit.offGoogle.citationConsistencyScore,
      hasSchema: audit.offGoogle.website.hasLocalBusinessSchema,
      socialPosts30d: audit.offGoogle.socialPostCountLast30Days,
    },
  };

  return JSON.stringify(payload, null, 2);
}

export function buildStrategyContext(
  audit: Phase1AuditPayload,
  strategy: StrategyReport
): string {
  return JSON.stringify(
    {
      audit: JSON.parse(buildAuditContext(audit)),
      strategy: {
        scores: strategy.scores,
        gaps: strategy.gaps.slice(0, 12).map((g) => ({
          id: g.id,
          priority: g.priority,
          category: g.category,
          title: g.title,
          description: g.description,
        })),
        actionPlan: strategy.actionPlan.map((a) => ({
          id: a.id,
          priority: a.priority,
          category: a.category,
          title: a.title,
          description: a.description,
        })),
        monthOverMonth: strategy.monthOverMonth,
      },
    },
    null,
    2
  );
}

export function buildContentContext(audit: FullAuditPayload): string {
  return buildStrategyContext(audit, audit.strategy);
}
