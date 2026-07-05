import type { ClientConfig } from "@/audit/types";
import type { CompetitorProfile, CompetitorSnapshot, GeoGridPoint, KeywordRankSnapshot, RankSnapshot } from "@/audit/types";
import {
  geocodeAddress,
  milesToMeters,
  searchPlaces,
  SEARCH_RADII_MILES,
  type GeoLocation,
  type PlaceResult,
  type SearchRadiusMiles,
} from "./places";
import { collectKeywordGeoGrid } from "./geo-grid";
import { gridProfileForCollection } from "@/lib/feature-flags";

const TOP_COMPETITORS = 5;
/** Radii tried when harvesting competitors (ranking still uses all four). */
const COMPETITOR_SEARCH_RADII: SearchRadiusMiles[] = [1, 3, 5];

export interface BusinessMatchOptions {
  businessName: string;
  placeId?: string;
  businessAddress?: string;
}

/**
 * Match the target business in an ordered Places result list.
 * Prefers place_id when available; falls back to normalized exact name match.
 */
export function isOwnBusiness(
  place: PlaceResult,
  { businessName, placeId, businessAddress }: BusinessMatchOptions
): boolean {
  if (placeId && place.placeId === placeId) return true;

  const normalizedPlace = normalizeBusinessName(place.name);
  const normalizedBusiness = normalizeBusinessName(businessName);
  if (normalizedPlace && normalizedBusiness && normalizedPlace === normalizedBusiness) {
    return true;
  }

  if (businessAddress && place.address) {
    const addrFragment = businessAddress.split(",")[0]?.trim().toLowerCase();
    if (addrFragment && addrFragment.length >= 5 && place.address.toLowerCase().includes(addrFragment)) {
      return true;
    }
  }

  return false;
}

function normalizeBusinessName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Rank in ordered list (1-indexed), or null if not found. */
export function findBusinessRank(
  results: PlaceResult[],
  options: BusinessMatchOptions
): number | null {
  const match = results.find((place) => isOwnBusiness(place, options));
  return match?.position ?? null;
}

export function extractCompetitors(
  results: PlaceResult[],
  options: BusinessMatchOptions,
  limit = TOP_COMPETITORS
): PlaceResult[] {
  return results
    .filter((place) => !isOwnBusiness(place, options))
    .slice(0, limit);
}

/**
 * Merge additional Places results into a competitor list, skipping duplicates and own business.
 */
export function mergeCompetitorCandidates(
  existing: PlaceResult[],
  incoming: PlaceResult[],
  options: BusinessMatchOptions,
  limit: number
): PlaceResult[] {
  const seen = new Set(existing.map((place) => place.placeId));
  const merged = [...existing];

  for (const place of incoming) {
    if (isOwnBusiness(place, options)) continue;
    if (seen.has(place.placeId)) continue;
    seen.add(place.placeId);
    merged.push({ ...place, position: merged.length + 1 });
    if (merged.length >= limit) break;
  }

  return merged;
}

export interface ResolveCompetitorOptions {
  limit?: number;
  /** Seed list (e.g. 1mi Nearby results already fetched for rankings). */
  initialResults?: PlaceResult[];
  /** City/state appended to Text Search queries — closer to Maps UI behavior. */
  locationLabel?: string;
}

/**
 * Harvest competitors for a keyword using multiple search strategies.
 * Nearby Search at 1mi can return ZERO_RESULTS while Maps shows businesses via Text Search.
 */
export function buildCompetitorTextQuery(keyword: string, locationLabel?: string): string {
  const trimmed = locationLabel?.trim();
  if (!trimmed) return keyword;

  const city = trimmed.split(",")[0]?.trim().toLowerCase();
  if (city && city.length >= 3 && keyword.toLowerCase().includes(city)) {
    return keyword;
  }

  return `${keyword} in ${trimmed}`;
}

export async function resolveCompetitorResults(
  keyword: string,
  location: GeoLocation,
  matchOptions: BusinessMatchOptions,
  options: ResolveCompetitorOptions = {}
): Promise<PlaceResult[]> {
  const limit = options.limit ?? TOP_COMPETITORS;
  const textQuery = buildCompetitorTextQuery(keyword, options.locationLabel);

  let competitors = extractCompetitors(options.initialResults ?? [], matchOptions, limit);
  if (competitors.length >= limit) return competitors;

  for (const miles of COMPETITOR_SEARCH_RADII) {
    const radiusMeters = milesToMeters(miles);

    // Skip re-fetching 1mi nearby when we already seeded from rankings.
    if (!(miles === 1 && options.initialResults)) {
      const nearbyResults = await searchPlaces(keyword, location, radiusMeters, "nearby");
      competitors = mergeCompetitorCandidates(competitors, nearbyResults, matchOptions, limit);
      if (competitors.length >= limit) return competitors;
    }

    try {
      const textResults = await searchPlaces(keyword, location, radiusMeters, "text", {
        textQuery,
      });
      competitors = mergeCompetitorCandidates(competitors, textResults, matchOptions, limit);
    } catch {
      // Text search is supplemental; nearby results still power rankings.
    }
    if (competitors.length >= limit) return competitors;
  }

  return competitors;
}

function formatClientAddress(client: ClientConfig): string {
  const { address, city, state, zip } = client.location;
  return `${address}, ${city}, ${state} ${zip}`;
}

export async function resolveBusinessLocation(client: ClientConfig): Promise<GeoLocation> {
  const { lat, lng } = client.location;
  if (lat && lng) {
    return { lat, lng };
  }
  return geocodeAddress(formatClientAddress(client));
}

function primaryCategoryFromTypes(types: string[]): string {
  const skip = new Set(["point_of_interest", "establishment", "geocode"]);
  const category = types.find((t) => !skip.has(t));
  return category ? category.replace(/_/g, " ") : "local business";
}

function toCompetitorProfile(
  place: PlaceResult,
  keyword: string
): CompetitorProfile {
  return {
    name: place.name,
    placeId: place.placeId,
    averageRating: place.rating ?? 0,
    reviewCount: place.reviewCount,
    newReviewsThisMonth: 0,
    postsLast30Days: 0,
    photoCount: 0,
    lastPostDate: null,
    primaryCategory: primaryCategoryFromTypes(place.types),
    descriptionLength: 0,
    attributeCount: 0,
    mapPositions: {
      [keyword]: place.position <= 3 ? (place.position as 1 | 2 | 3) : "not_in_pack",
    },
    reviewThemes: [],
  };
}

function buildKeywordSnapshot(
  keyword: string,
  ranksByRadius: Record<SearchRadiusMiles, number | null>,
  resultsAt1Mi: PlaceResult[],
  matchOptions: BusinessMatchOptions,
  geoGrid?: GeoGridPoint[]
): KeywordRankSnapshot {
  const rankAt1Mi = ranksByRadius[1];
  const inLocalPack = rankAt1Mi !== null && rankAt1Mi <= 3;
  const localPackPosition = inLocalPack ? (rankAt1Mi as 1 | 2 | 3) : "not_in_pack";

  const leader = resultsAt1Mi[0];
  const ownPlace = resultsAt1Mi.find((p) => isOwnBusiness(p, matchOptions));

  return {
    keyword,
    localPackPosition,
    inLocalPack,
    geoRanks: SEARCH_RADII_MILES.map((distanceMiles) => {
      const rank = ranksByRadius[distanceMiles];
      return {
        distanceMiles,
        rank,
        inLocalPack: rank !== null && rank <= 3,
      };
    }),
    packLeaderRating: leader?.rating ?? 0,
    packLeaderReviewCount: leader?.reviewCount ?? 0,
    clientRating: ownPlace?.rating ?? 0,
    clientReviewCount: ownPlace?.reviewCount ?? 0,
    geoGrid,
  };
}

export interface KeywordRankSearchResult {
  keyword: string;
  ranksByRadius: Record<SearchRadiusMiles, number | null>;
  resultsByRadius: Record<SearchRadiusMiles, PlaceResult[]>;
}

/**
 * Search one keyword at 1/3/5/10 mile radii via Places Nearby Search.
 */
export async function searchKeywordAtAllRadii(
  keyword: string,
  location: GeoLocation,
  matchOptions: BusinessMatchOptions,
  mode: "nearby" | "text" = "nearby"
): Promise<KeywordRankSearchResult> {
  const ranksByRadius = {} as Record<SearchRadiusMiles, number | null>;
  const resultsByRadius = {} as Record<SearchRadiusMiles, PlaceResult[]>;

  for (const miles of SEARCH_RADII_MILES) {
    const results = await searchPlaces(keyword, location, milesToMeters(miles), mode);
    resultsByRadius[miles] = results;
    ranksByRadius[miles] = findBusinessRank(results, matchOptions);
  }

  return { keyword, ranksByRadius, resultsByRadius };
}

export interface OneMileRankResult {
  rank: number | null;
  inLocalPack: boolean;
  localPackPosition: number | null;
}

/** Lightweight 1-mile rank check for daily ingest (avoids full geo grid). */
export async function searchKeywordAtOneMile(
  keyword: string,
  location: GeoLocation,
  matchOptions: BusinessMatchOptions
): Promise<OneMileRankResult> {
  const results = await searchPlaces(keyword, location, milesToMeters(1), "nearby");
  const rank = findBusinessRank(results, matchOptions);
  const inLocalPack = rank !== null && rank <= 3;

  return {
    rank,
    inLocalPack,
    localPackPosition: inLocalPack ? rank : null,
  };
}

/**
 * Full ranking + competitor harvest for all client keywords.
 * Uses Google Places directly — Local Maps ordering, not desktop organic SERP.
 */
export async function collectPlacesRankData(client: ClientConfig): Promise<{
  rankings: RankSnapshot;
  competitors: CompetitorSnapshot[];
}> {
  const now = new Date().toISOString();
  const location = await resolveBusinessLocation(client);
  const matchOptions: BusinessMatchOptions = {
    businessName: client.name,
    placeId: client.gbpPlaceId,
    businessAddress: formatClientAddress(client),
  };

  const keywords: KeywordRankSnapshot[] = [];
  const competitorSnapshots: CompetitorSnapshot[] = [];

  for (const keyword of client.keywords) {
    const { ranksByRadius, resultsByRadius } = await searchKeywordAtAllRadii(
      keyword,
      location,
      matchOptions,
      "nearby"
    );

    const geoGrid = await collectKeywordGeoGrid(keyword, location, matchOptions, {
      profile: gridProfileForCollection("audit", client.heatmapProfile),
      includeLocalPack: true,
    });

    keywords.push(
      buildKeywordSnapshot(
        keyword,
        ranksByRadius,
        resultsByRadius[1],
        matchOptions,
        geoGrid
      )
    );

    const competitorPlaces = await resolveCompetitorResults(
      keyword,
      location,
      matchOptions,
      {
        limit: TOP_COMPETITORS,
        initialResults: resultsByRadius[1],
        locationLabel: `${client.location.city}, ${client.location.state}`,
      }
    );
    competitorSnapshots.push({
      collectedAt: now,
      keyword,
      competitors: competitorPlaces.map((p) => toCompetitorProfile(p, keyword)),
    });
  }

  const keywordsInPack = keywords.filter((k) => k.inLocalPack).length;

  return {
    rankings: {
      collectedAt: now,
      keywords,
      shareOfVoice: keywords.length
        ? Math.round((keywordsInPack / keywords.length) * 100)
        : 0,
      keywordsInPack,
      totalKeywords: keywords.length,
    },
    competitors: competitorSnapshots,
  };
}
