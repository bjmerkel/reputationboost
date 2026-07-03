import type {
  GbpCurrentStateSummary,
  GbpProfileField,
  KeywordRankAnalysis,
  Phase1AuditPayload,
} from "../types";

function profile(audit: Phase1AuditPayload) {
  return audit.gbp.liveProfile;
}

function descriptionText(audit: Phase1AuditPayload): string {
  return profile(audit)?.description ?? "";
}

function serviceNames(audit: Phase1AuditPayload): string[] {
  return (profile(audit)?.services ?? []).map((s) => s.name.toLowerCase());
}

function textContainsKeyword(text: string, keyword: string): boolean {
  const normalized = keyword.toLowerCase();
  const words = normalized.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return text.toLowerCase().includes(normalized);
  return words.some((w) => text.toLowerCase().includes(w));
}

function keywordInProfile(audit: Phase1AuditPayload, keyword: string): boolean {
  const desc = descriptionText(audit);
  const services = serviceNames(audit);
  const posts = (audit.gbp.recentPosts ?? []).map((p) => p.summary).join(" ");
  const combined = `${desc} ${services.join(" ")} ${posts} ${audit.gbp.identity.primaryCategory}`;
  return textContainsKeyword(combined, keyword);
}

function missingServiceKeywords(audit: Phase1AuditPayload): string[] {
  const keywords = audit.rankings.keywords.map((k) => k.keyword);
  const services = serviceNames(audit);
  return keywords.filter(
    (kw) => !services.some((s) => textContainsKeyword(s, kw))
  );
}

function daysSincePost(audit: Phase1AuditPayload): number | null {
  const last = audit.gbp.content.lastPostDate;
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
}

function fieldStatus(
  value: string | number,
  goodCheck: boolean
): GbpProfileField["status"] {
  if (!value && value !== 0) return "missing";
  return goodCheck ? "good" : "needs_work";
}

export function buildGbpCurrentState(audit: Phase1AuditPayload): GbpCurrentStateSummary {
  const live = profile(audit);
  const desc = descriptionText(audit);
  const descLen = desc.length;
  const services = live?.services ?? [];
  const secondary = live?.secondaryCategories ?? audit.gbp.identity.secondaryCategories;
  const posts = audit.gbp.recentPosts ?? [];
  const daysSince = daysSincePost(audit);

  const fields: GbpProfileField[] = [
    {
      label: "Primary category",
      current: live?.primaryCategory || audit.gbp.identity.primaryCategory || "Not set",
      status: fieldStatus(live?.primaryCategory ?? "", Boolean(live?.primaryCategory)),
    },
    {
      label: "Secondary categories",
      current: secondary.length ? secondary.join(", ") : "None listed",
      status: fieldStatus(secondary.join(""), secondary.length >= 2),
    },
    {
      label: "Business description",
      current: desc
        ? `${descLen} chars — "${desc.slice(0, 120)}${descLen > 120 ? "…" : ""}"`
        : "Empty — no description on profile",
      status: fieldStatus(desc, descLen >= 400),
    },
    {
      label: "Services",
      current: services.length
        ? `${services.length} listed: ${services.map((s) => s.name).join(", ")}`
        : "No services on profile",
      status: fieldStatus(String(services.length), services.length >= audit.rankings.totalKeywords),
    },
    {
      label: "Photos",
      current: `${audit.gbp.content.photoCount} photos`,
      status: fieldStatus(String(audit.gbp.content.photoCount), audit.gbp.content.photoCount >= 50),
    },
    {
      label: "Google Posts",
      current: posts.length
        ? `${audit.gbp.content.postCount} total · last post ${daysSince ?? "?"} days ago`
        : "No posts found",
      status: fieldStatus(String(posts.length), daysSince !== null && daysSince <= 14),
    },
    {
      label: "Q&A",
      current: `${audit.gbp.content.qaCount} questions · ${audit.gbp.content.unansweredQa} unanswered`,
      status: fieldStatus(
        String(audit.gbp.content.qaCount),
        audit.gbp.content.unansweredQa === 0 && audit.gbp.content.qaCount >= 5
      ),
    },
    {
      label: "Reviews",
      current: `${audit.gbp.engagement.reviewCount} reviews · ${audit.gbp.engagement.averageRating}★ · ${Math.round(audit.gbp.engagement.responseRate * 100)}% responded`,
      status: fieldStatus(
        String(audit.gbp.engagement.reviewCount),
        audit.gbp.engagement.responseRate >= 0.9
      ),
    },
    {
      label: "Attributes",
      current: (live?.attributes ?? []).length
        ? (live?.attributes ?? []).slice(0, 6).join(", ")
        : "None detected",
      status: fieldStatus(
        String(live?.attributes?.length ?? 0),
        (live?.attributes?.length ?? 0) >= 3
      ),
    },
  ];

  const profileGaps: string[] = [];
  if (descLen < 400) profileGaps.push(`Description is only ${descLen} characters — aim for 600-750`);
  if (services.length === 0) profileGaps.push("No GBP services listed — add one per target keyword");
  if (secondary.length < 2) profileGaps.push("Add secondary categories that match your target keywords");
  if (daysSince === null || daysSince > 14)
    profileGaps.push("No Google Post in the last 2 weeks — publish weekly posts");
  if (audit.gbp.content.unansweredQa > 0)
    profileGaps.push(`${audit.gbp.content.unansweredQa} Q&A question(s) need answers`);
  if (audit.gbp.engagement.responseRate < 0.9)
    profileGaps.push(`Review response rate is ${Math.round(audit.gbp.engagement.responseRate * 100)}% — target 100%`);
  if (audit.gbp.content.photoCount < 50)
    profileGaps.push(`Only ${audit.gbp.content.photoCount} photos — competitors often have 100+`);

  const missingKw = missingServiceKeywords(audit);
  if (missingKw.length > 0) {
    profileGaps.push(`Keywords missing from services/description: ${missingKw.join(", ")}`);
  }

  return { fields, profileGaps };
}

export function buildKeywordRankAnalysis(audit: Phase1AuditPayload): KeywordRankAnalysis[] {
  return audit.rankings.keywords.map((kw) => {
    const rank1 = kw.geoRanks.find((g) => g.distanceMiles === 1)?.rank ?? null;
    const rank3 = kw.geoRanks.find((g) => g.distanceMiles === 3)?.rank ?? null;
    const rank5 = kw.geoRanks.find((g) => g.distanceMiles === 5)?.rank ?? null;
    const reviewGap = Math.max(0, kw.packLeaderReviewCount - kw.clientReviewCount);
    const inProfile = keywordInProfile(audit, kw.keyword);

    const gbpUpdates: string[] = [];
    if (!kw.inLocalPack) {
      gbpUpdates.push(`Add "${kw.keyword}" as a named GBP service with a local description`);
      gbpUpdates.push(`Publish a Google Post this week targeting "${kw.keyword}"`);
      if (!inProfile) {
        gbpUpdates.push(`Weave "${kw.keyword}" into your business description`);
      }
      if (reviewGap > 20) {
        gbpUpdates.push(
          `Close review gap (${kw.clientReviewCount} vs leader's ${kw.packLeaderReviewCount}) — request reviews mentioning this service`
        );
      }
      gbpUpdates.push("Add photos specific to this service type");
    } else {
      gbpUpdates.push(`Defend #${kw.localPackPosition} position — keep weekly posts mentioning "${kw.keyword}"`);
      if (!inProfile) {
        gbpUpdates.push(`Strengthen relevance: add "${kw.keyword}" to description or services`);
      }
    }

    const position = kw.inLocalPack
      ? `#${kw.localPackPosition} in 3-Pack`
      : rank1
        ? `#${rank1} at 1 mi (outside 3-Pack)`
        : "Not ranking in top results";

    return {
      keyword: kw.keyword,
      inLocalPack: kw.inLocalPack,
      position,
      rankAt1Mi: rank1,
      rankAt3Mi: rank3,
      rankAt5Mi: rank5,
      packLeaderReviews: kw.packLeaderReviewCount,
      clientReviews: kw.clientReviewCount,
      reviewGap,
      gbpUpdates,
    };
  });
}

export function inferRecommendedSecondaryCategories(audit: Phase1AuditPayload): string[] {
  const existing = new Set(
    (audit.gbp.liveProfile?.secondaryCategories ?? audit.gbp.identity.secondaryCategories).map((c) =>
      c.toLowerCase()
    )
  );
  const primary = audit.gbp.identity.primaryCategory;
  const suggestions: string[] = [];

  for (const kw of audit.rankings.keywords) {
    if (kw.keyword.toLowerCase().includes("airport") && !existing.has("airport shuttle service")) {
      suggestions.push("Airport Shuttle Service");
    }
    if (
      (kw.keyword.toLowerCase().includes("wedding") ||
        kw.keyword.toLowerCase().includes("limo")) &&
      !existing.has("limousine service")
    ) {
      suggestions.push("Limousine Service");
    }
  }

  if (suggestions.length === 0 && primary) {
    suggestions.push(`${primary} (keep as primary)`);
  }

  return [...new Set(suggestions)].filter(
    (s) => !s.toLowerCase().includes("keep as primary") || suggestions.length === 1
  ).slice(0, 5);
}

export function missingKeywordsForServices(audit: Phase1AuditPayload): string[] {
  return missingServiceKeywords(audit);
}
