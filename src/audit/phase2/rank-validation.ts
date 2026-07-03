import type { GeoLocation } from "@/lib/google/places";
import {
  buildCompetitorTextQuery,
  findBusinessRank,
  type BusinessMatchOptions,
} from "@/lib/google/local-rankings";
import { milesToMeters, searchPlaces } from "@/lib/google/places";

export interface KeywordRankValidation {
  keyword: string;
  nearbyRank: number | null;
  textRank: number | null;
  rankDelta: number | null;
  absRankDelta: number | null;
  nearbyInPack: boolean;
  textInPack: boolean;
  packDisagreement: boolean;
  rankDisagreement: boolean;
}

export interface RankValidationSummary {
  keywordCount: number;
  packDisagreementCount: number;
  packDisagreementRate: number;
  rankDisagreementCount: number;
  rankDisagreementRate: number;
  meanAbsRankDelta: number | null;
  maxAbsRankDelta: number | null;
}

function inLocalPack(rank: number | null): boolean {
  return rank !== null && rank <= 3;
}

/** Pure comparison from two 1-mile rank probes (Nearby vs Text Search). */
export function compareRanksAtOneMile(
  keyword: string,
  nearbyRank: number | null,
  textRank: number | null
): KeywordRankValidation {
  const nearbyInPack = inLocalPack(nearbyRank);
  const textInPack = inLocalPack(textRank);
  const rankDelta =
    nearbyRank != null && textRank != null ? nearbyRank - textRank : null;
  const absRankDelta = rankDelta != null ? Math.abs(rankDelta) : null;

  return {
    keyword,
    nearbyRank,
    textRank,
    rankDelta,
    absRankDelta,
    nearbyInPack,
    textInPack,
    packDisagreement: nearbyInPack !== textInPack,
    rankDisagreement: rankDelta !== null && rankDelta !== 0,
  };
}

export function summarizeRankValidation(
  results: KeywordRankValidation[]
): RankValidationSummary {
  if (results.length === 0) {
    return {
      keywordCount: 0,
      packDisagreementCount: 0,
      packDisagreementRate: 0,
      rankDisagreementCount: 0,
      rankDisagreementRate: 0,
      meanAbsRankDelta: null,
      maxAbsRankDelta: null,
    };
  }

  const packDisagreementCount = results.filter((r) => r.packDisagreement).length;
  const rankDisagreementCount = results.filter((r) => r.rankDisagreement).length;
  const deltas = results
    .map((r) => r.absRankDelta)
    .filter((d): d is number => d != null);

  return {
    keywordCount: results.length,
    packDisagreementCount,
    packDisagreementRate: packDisagreementCount / results.length,
    rankDisagreementCount,
    rankDisagreementRate: rankDisagreementCount / results.length,
    meanAbsRankDelta:
      deltas.length > 0
        ? Math.round((deltas.reduce((s, d) => s + d, 0) / deltas.length) * 10) / 10
        : null,
    maxAbsRankDelta: deltas.length > 0 ? Math.max(...deltas) : null,
  };
}

export interface CompareSearchModesOptions {
  locationLabel?: string;
}

/**
 * Live validation: compare Nearby Search vs Text Search at 1 mile for one keyword.
 * Text Search uses the same query phrasing as competitor harvest (closer to Maps UI).
 */
export async function compareSearchModesAtOneMile(
  keyword: string,
  location: GeoLocation,
  matchOptions: BusinessMatchOptions,
  options: CompareSearchModesOptions = {}
): Promise<KeywordRankValidation> {
  const radiusMeters = milesToMeters(1);
  const textQuery = buildCompetitorTextQuery(keyword, options.locationLabel);

  const [nearbyResults, textResults] = await Promise.all([
    searchPlaces(keyword, location, radiusMeters, "nearby"),
    searchPlaces(keyword, location, radiusMeters, "text", { textQuery }),
  ]);

  const nearbyRank = findBusinessRank(nearbyResults, matchOptions);
  const textRank = findBusinessRank(textResults, matchOptions);

  return compareRanksAtOneMile(keyword, nearbyRank, textRank);
}

/** Validate a sample of keywords via live Google Places API. */
export async function validateKeywordRanks(
  keywords: string[],
  location: GeoLocation,
  matchOptions: BusinessMatchOptions,
  options: CompareSearchModesOptions = {}
): Promise<{ results: KeywordRankValidation[]; summary: RankValidationSummary }> {
  const results: KeywordRankValidation[] = [];

  for (const keyword of keywords) {
    results.push(
      await compareSearchModesAtOneMile(keyword, location, matchOptions, options)
    );
  }

  return { results, summary: summarizeRankValidation(results) };
}
