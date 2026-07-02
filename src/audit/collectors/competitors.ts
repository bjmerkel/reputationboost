import type { ClientConfig, CompetitorProfile, CompetitorSnapshot } from "../types";

/**
 * Collects top-5 competitor snapshots per target keyword.
 */
export async function collectCompetitorSnapshots(
  client: ClientConfig
): Promise<CompetitorSnapshot[]> {
  if (process.env.RANK_TRACKER_API_KEY) {
    return collectCompetitorsFromApi(client);
  }
  return collectCompetitorsDemo(client);
}

async function collectCompetitorsFromApi(
  client: ClientConfig
): Promise<CompetitorSnapshot[]> {
  void client;
  throw new Error(
    "Live competitor collector pending. Set RANK_TRACKER_API_KEY and implement collectCompetitorsFromApi."
  );
}

function collectCompetitorsDemo(client: ClientConfig): CompetitorSnapshot[] {
  const now = new Date().toISOString();

  return client.keywords.slice(0, 3).map((keyword, index) => ({
    collectedAt: now,
    keyword,
    competitors: buildCompetitorsForKeyword(keyword, index),
  }));
}

function buildCompetitorsForKeyword(
  keyword: string,
  seed: number
): CompetitorProfile[] {
  const names = [
    "Mission Bay Stucco Pros",
    "Elite Exterior Coatings",
    "Harbor View Plaster",
    "Coastal Craft Stucco",
    "Premier SD Stucco",
  ];

  return names.map((name, i) => ({
    name,
    placeId: `ChIJ-competitor-${seed}-${i}`,
    averageRating: round(4.9 - i * 0.15 + (seed % 3) * 0.05),
    reviewCount: 312 - i * 48 + seed * 12,
    newReviewsThisMonth: Math.max(2, 14 - i * 2),
    postsLast30Days: Math.max(0, 6 - i),
    photoCount: 80 - i * 10,
    lastPostDate: daysAgo(3 + i * 4),
    primaryCategory: "Stucco contractor",
    descriptionLength: 600 - i * 40,
    attributeCount: 8 - i,
    mapPositions: { [keyword]: i === 0 ? 1 : i < 3 ? (i + 1) as 2 | 3 : "not_in_pack" },
    reviewThemes:
      i === 0
        ? ["fast response", "quality work", "fair pricing"]
        : ["professional crew", "clean job site"],
  }));
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
