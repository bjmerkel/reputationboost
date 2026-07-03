import type { ClientConfig, GeoGridPoint, KeywordRankSnapshot, RankSnapshot } from "../types";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { buildDemoGeoGrid } from "@/lib/google/geo-grid";
import { collectPlacesRankData } from "@/lib/google/local-rankings";

const DISTANCES = [1, 3, 5, 10] as const;

/**
 * Collects Local 3-Pack positions and geo-grid rankings per keyword.
 * Uses Google Places (Nearby Search) when GOOGLE_MAPS_API_KEY is set; otherwise demo data.
 *
 * Ranking = position in Google's ordered Places result list for keyword + radius.
 * Rank null / not in pack = business not found in that result set.
 */
export async function collectRankSnapshot(client: ClientConfig): Promise<RankSnapshot> {
  if (isGoogleMapsConfigured()) {
    const { rankings } = await collectPlacesRankData(client);
    return rankings;
  }
  return collectRanksDemo(client);
}

function collectRanksDemo(client: ClientConfig): RankSnapshot {
  const now = new Date().toISOString();

  const keywordData: Array<{
    keyword: string;
    packPos: 1 | 2 | 3 | "not_in_pack";
    baseRank: number;
    leaderReviews: number;
  }> = [
    { keyword: client.keywords[0] ?? "san diego stucco", packPos: 2, baseRank: 2, leaderReviews: 312 },
    { keyword: client.keywords[1] ?? "stucco repair", packPos: "not_in_pack", baseRank: 8, leaderReviews: 198 },
    { keyword: client.keywords[2] ?? "exterior plaster", packPos: 1, baseRank: 1, leaderReviews: 89 },
    { keyword: client.keywords[3] ?? "stucco contractor near me", packPos: 3, baseRank: 3, leaderReviews: 445 },
    { keyword: client.keywords[4] ?? "stucco installation", packPos: "not_in_pack", baseRank: 11, leaderReviews: 156 },
  ];

  const keywords: KeywordRankSnapshot[] = keywordData.map((kw) => {
    const center = client.location;
    const baseRank = kw.packPos === "not_in_pack" ? kw.baseRank : (kw.packPos as number);
    return {
    keyword: kw.keyword,
    localPackPosition: kw.packPos,
    inLocalPack: kw.packPos !== "not_in_pack",
    geoRanks: DISTANCES.map((distanceMiles) => {
      const drift = distanceMiles > 5 ? 2 : 0;
      const rank = kw.packPos === "not_in_pack" ? kw.baseRank + drift : (kw.baseRank as number) + drift;
      return {
        distanceMiles,
        rank,
        inLocalPack: rank <= 3,
      };
    }),
    geoGrid: buildDemoGeoGrid(
      { lat: center.lat || 32.7157, lng: center.lng || -117.1611 },
      baseRank
    ),
    packLeaderRating: 4.8,
    packLeaderReviewCount: kw.leaderReviews,
    clientRating: 4.6,
    clientReviewCount: 47,
  };
  });

  const keywordsInPack = keywords.filter((k) => k.inLocalPack).length;

  return {
    collectedAt: now,
    keywords,
    shareOfVoice: Math.round((keywordsInPack / keywords.length) * 100),
    keywordsInPack,
    totalKeywords: keywords.length,
  };
}
