import type { CompetitorProfile, CompetitorSnapshot } from "@/audit/types";

export type CompetitorProfileIndex = Map<string, Map<string, CompetitorProfile>>;

function mergeProfile(
  existing: CompetitorProfile | undefined,
  incoming: CompetitorProfile
): CompetitorProfile {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    reviewCount: Math.max(existing.reviewCount, incoming.reviewCount),
    averageRating: incoming.averageRating || existing.averageRating,
    photoCount: Math.max(existing.photoCount, incoming.photoCount),
    postsLast30Days: Math.max(existing.postsLast30Days, incoming.postsLast30Days),
    newReviewsThisMonth: Math.max(
      existing.newReviewsThisMonth,
      incoming.newReviewsThisMonth
    ),
    descriptionLength: Math.max(existing.descriptionLength, incoming.descriptionLength),
    attributeCount: Math.max(existing.attributeCount, incoming.attributeCount),
    mapPositions: { ...existing.mapPositions, ...incoming.mapPositions },
    reviewThemes: incoming.reviewThemes.length
      ? incoming.reviewThemes
      : existing.reviewThemes,
  };
}

/** Keyword → placeId → richest competitor profile from audit snapshots. */
export function buildCompetitorProfileIndex(
  snapshots: CompetitorSnapshot[]
): CompetitorProfileIndex {
  const index: CompetitorProfileIndex = new Map();

  for (const snapshot of snapshots) {
    const keywordKey = snapshot.keyword.toLowerCase();
    const byPlace = index.get(keywordKey) ?? new Map<string, CompetitorProfile>();

    const profiles = [
      ...snapshot.localPack,
      ...snapshot.widerRadius.flatMap((tier) => tier.competitors),
      ...snapshot.textSearchFallback,
      ...snapshot.competitors,
    ];

    for (const profile of profiles) {
      if (!profile.placeId) continue;
      byPlace.set(profile.placeId, mergeProfile(byPlace.get(profile.placeId), profile));
    }

    index.set(keywordKey, byPlace);
  }

  return index;
}

export function resolveCompetitorProfile(
  index: CompetitorProfileIndex,
  keyword: string,
  placeId: string
): CompetitorProfile | null {
  return index.get(keyword.toLowerCase())?.get(placeId) ?? null;
}
