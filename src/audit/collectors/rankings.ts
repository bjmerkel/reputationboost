import type { ClientConfig, KeywordRankSnapshot, RankSnapshot } from "../types";

const DISTANCES = [1, 3, 5, 10] as const;

/**
 * Collects Local 3-Pack positions and geo-grid rankings per keyword.
 * Uses rank tracker API when RANK_TRACKER_API_KEY is set; otherwise demo data.
 */
export async function collectRankSnapshot(client: ClientConfig): Promise<RankSnapshot> {
  if (process.env.RANK_TRACKER_API_KEY) {
    return collectRanksFromApi(client);
  }
  return collectRanksDemo(client);
}

async function collectRanksFromApi(client: ClientConfig): Promise<RankSnapshot> {
  void client;
  throw new Error(
    "Live rank tracker integration pending. Set RANK_TRACKER_API_KEY and implement collectRanksFromApi."
  );
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

  const keywords: KeywordRankSnapshot[] = keywordData.map((kw) => ({
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
    packLeaderRating: 4.8,
    packLeaderReviewCount: kw.leaderReviews,
    clientRating: 4.6,
    clientReviewCount: 47,
  }));

  const keywordsInPack = keywords.filter((k) => k.inLocalPack).length;

  return {
    collectedAt: now,
    keywords,
    shareOfVoice: Math.round((keywordsInPack / keywords.length) * 100),
    keywordsInPack,
    totalKeywords: keywords.length,
  };
}
