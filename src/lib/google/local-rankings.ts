import type { ClientConfig } from "@/audit/types";
import type { CompetitorProfile, CompetitorSnapshot, GeoGridPoint, KeywordRankSnapshot, RankSnapshot } from "@/audit/types";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import { gridProfileForCollection } from "@/lib/feature-flags";
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
import { resolveOwnedBusinessCoordinates } from "./owned-business-resolver";
import { isRadialRankGrid, summarizeRadialRanks } from "./radial-rankings";

const TOP_COMPETITORS = 5;
/** Keywords collected in parallel during audits (each keyword still batches its own grid). */
const KEYWORD_COLLECTION_CONCURRENCY = 2;
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

/** Google's 1-indexed rank for a keyword, falling back to list order for legacy snapshots. */
export function competitorMapRank(
  mapPositions: Record<string, number | "not_in_pack">,
  keyword: string,
  listIndex: number
): number {
  const pos = mapPositions[keyword];
  return typeof pos === "number" ? pos : listIndex + 1;
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
    // Preserve Google's 1-indexed position from the source result list.
    merged.push(place);
    if (merged.length >= limit) break;
  }

  return merged;
}

export interface ResolveCompetitorOptions {
  limit?: number;
  /** Seed list (e.g. 1mi Nearby results already fetched for rankings). */
  initialResults?: PlaceResult[];
  /** City/state label for Text Search fallback phrasing. */
  locationLabel?: string;
}

export interface CompetitorRadiusTierResult {
  radiusMiles: 3 | 5;
  competitors: PlaceResult[];
}

export interface CompetitorHarvestResult {
  localPack: PlaceResult[];
  widerRadius: CompetitorRadiusTierResult[];
  textSearchFallback: PlaceResult[];
  nearbyHasResults: boolean;
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

function extractTierCompetitors(
  results: PlaceResult[],
  matchOptions: BusinessMatchOptions,
  seen: Set<string>,
  limit: number
): PlaceResult[] {
  const tier: PlaceResult[] = [];

  for (const place of results) {
    if (isOwnBusiness(place, matchOptions)) continue;
    if (seen.has(place.placeId)) continue;
    seen.add(place.placeId);
    tier.push(place);
    if (tier.length >= limit) break;
  }

  return tier;
}

/**
 * Harvest competitors in tiers: 1 mi Nearby (pack), wider Nearby (3/5 mi), then Text Search.
 * Each tier keeps Google's positions from its own result list — tiers are not merged.
 */
export async function resolveCompetitorResults(
  keyword: string,
  location: GeoLocation,
  matchOptions: BusinessMatchOptions,
  options: ResolveCompetitorOptions = {}
): Promise<CompetitorHarvestResult> {
  const limit = options.limit ?? TOP_COMPETITORS;
  const initialResults = options.initialResults ?? [];
  const seen = new Set<string>();

  const localPack = extractTierCompetitors(initialResults, matchOptions, seen, limit);
  const widerRadius: CompetitorRadiusTierResult[] = [];

  if (localPack.length < limit) {
    for (const miles of [3, 5] as const) {
      const nearbyResults = await searchPlaces(keyword, location, milesToMeters(miles), "nearby").catch(
        () => [] as PlaceResult[]
      );
      const tierCompetitors = extractTierCompetitors(nearbyResults, matchOptions, seen, limit);
      if (tierCompetitors.length > 0) {
        widerRadius.push({ radiusMiles: miles, competitors: tierCompetitors });
      }
    }
  }

  let textSearchFallback: PlaceResult[] = [];
  const hasNearbyCompetitors = localPack.length > 0 || widerRadius.some((tier) => tier.competitors.length > 0);

  if (!hasNearbyCompetitors) {
    const textQuery = buildCompetitorTextQuery(keyword, options.locationLabel);
    const textResults = await searchPlaces(keyword, location, milesToMeters(5), "text", {
      textQuery,
    }).catch(() => [] as PlaceResult[]);
    textSearchFallback = extractCompetitors(textResults, matchOptions, limit);
  }

  return {
    localPack,
    widerRadius,
    textSearchFallback,
    nearbyHasResults: initialResults.length > 0,
  };
}

/** Flatten tiered harvest into one list (1 mi first, then wider, then text fallback). */
export function flattenCompetitorHarvest(harvest: CompetitorHarvestResult): PlaceResult[] {
  return [
    ...harvest.localPack,
    ...harvest.widerRadius.flatMap((tier) => tier.competitors),
    ...harvest.textSearchFallback,
  ];
}

function formatClientAddress(client: ClientConfig): string {
  const { address, city, state, zip } = client.location;
  return `${address}, ${city}, ${state} ${zip}`;
}

export async function resolveBusinessLocation(client: ClientConfig): Promise<GeoLocation> {
  const stored = resolveOwnedBusinessCoordinates(client);
  if (stored) return stored;
  return geocodeAddress(client.gbpAddress || formatClientAddress(client));
}

async function loadAuditGeoGrid(
  client: ClientConfig,
  keyword: string,
  location: GeoLocation,
  matchOptions: BusinessMatchOptions,
  resolveStoredGrid?: (keyword: string) => Promise<GeoGridPoint[] | null>
): Promise<GeoGridPoint[]> {
  const stored = resolveStoredGrid ? await resolveStoredGrid(keyword) : null;
  if (stored?.length && isRadialRankGrid(stored)) return stored;

  return collectKeywordGeoGrid(keyword, location, matchOptions, {
    profile: gridProfileForCollection("audit", client.heatmapProfile),
    includeLocalPack: true,
  });
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
      [keyword]: place.position,
    },
    reviewThemes: [],
  };
}

function formatClientLocationLabel(client: ClientConfig): string {
  const { city, state } = client.location;
  return `${city}, ${state}`;
}

function buildCompetitorSnapshot(
  keyword: string,
  collectedAt: string,
  harvest: CompetitorHarvestResult
): CompetitorSnapshot {
  const localPack = harvest.localPack.map((place) => toCompetitorProfile(place, keyword));

  return {
    collectedAt,
    keyword,
    localPack,
    widerRadius: harvest.widerRadius.map((tier) => ({
      radiusMiles: tier.radiusMiles,
      competitors: tier.competitors.map((place) => toCompetitorProfile(place, keyword)),
    })),
    textSearchFallback: harvest.textSearchFallback.map((place) =>
      toCompetitorProfile(place, keyword)
    ),
    nearbyHasResults: harvest.nearbyHasResults,
    competitors: localPack,
  };
}

const EMPTY_COMPETITOR_HARVEST: CompetitorHarvestResult = {
  localPack: [],
  widerRadius: [],
  textSearchFallback: [],
  nearbyHasResults: false,
};

function buildKeywordSnapshot(
  keyword: string,
  geoGrid: GeoGridPoint[],
  centerDetailsResults: PlaceResult[],
  matchOptions: BusinessMatchOptions,
): KeywordRankSnapshot {
  const radial = summarizeRadialRanks(geoGrid);
  const inLocalPack = radial.centerInTop3;
  const localPackPosition = inLocalPack
    ? (radial.centerRank as 1 | 2 | 3)
    : "not_in_pack";

  const leader = centerDetailsResults[0];
  const ownPlace = centerDetailsResults.find((p) => isOwnBusiness(p, matchOptions));

  return {
    keyword,
    localPackPosition,
    inLocalPack,
    rankingModel: "radial_text_v2",
    centerRank: radial.centerRank,
    geoRanks: radial.rings,
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

  const radiusResults = await Promise.all(
    SEARCH_RADII_MILES.map(async (miles) => {
      try {
        const results = await searchPlaces(keyword, location, milesToMeters(miles), mode);
        return { miles, results };
      } catch {
        return { miles, results: [] as PlaceResult[] };
      }
    })
  );

  for (const { miles, results } of radiusResults) {
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

/** Lightweight business-pin Text Search check for daily ingest (avoids full radial scan). */
export async function searchKeywordAtOneMile(
  keyword: string,
  location: GeoLocation,
  matchOptions: BusinessMatchOptions
): Promise<OneMileRankResult> {
  const results = await searchPlaces(keyword, location, milesToMeters(1), "text", {
    maxPages: 1,
    rankFieldsOnly: true,
  });
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
export async function collectPlacesRankData(
  client: ClientConfig,
  options: {
    /** Reuse a stored geo-grid instead of live Places calls (server-side audits). */
    resolveStoredGrid?: (keyword: string) => Promise<GeoGridPoint[] | null>;
  } = {}
): Promise<{
  rankings: RankSnapshot;
  competitors: CompetitorSnapshot[];
}> {
  const now = new Date().toISOString();
  const location = await resolveBusinessLocation(client);
  const matchOptions: BusinessMatchOptions = {
    businessName: client.name,
    placeId: client.gbpPlaceId,
    businessAddress: client.gbpAddress || formatClientAddress(client),
  };

  const keywords: KeywordRankSnapshot[] = [];
  const competitorSnapshots: CompetitorSnapshot[] = [];

  const keywordResults = await mapWithConcurrency(
    client.keywords,
    KEYWORD_COLLECTION_CONCURRENCY,
    async (keyword) => {
      try {
        const [geoGrid, centerDetailsResults] = await Promise.all([
          loadAuditGeoGrid(client, keyword, location, matchOptions, options.resolveStoredGrid),
          searchPlaces(keyword, location, milesToMeters(1), "nearby").catch(
            () => [] as PlaceResult[]
          ),
        ]);
        const competitorHarvest = await resolveCompetitorResults(
          keyword,
          location,
          matchOptions,
          {
            limit: TOP_COMPETITORS,
            initialResults: centerDetailsResults,
            locationLabel: formatClientLocationLabel(client),
          }
        );

        return {
          keyword,
          geoGrid,
          centerDetailsResults,
          competitorHarvest,
        };
      } catch {
        return {
          keyword,
          geoGrid: [] as GeoGridPoint[],
          centerDetailsResults: [] as PlaceResult[],
          competitorHarvest: EMPTY_COMPETITOR_HARVEST,
        };
      }
    }
  );

  for (const result of keywordResults) {
    keywords.push(
      buildKeywordSnapshot(
        result.keyword,
        result.geoGrid,
        result.centerDetailsResults,
        matchOptions
      )
    );

    competitorSnapshots.push(
      buildCompetitorSnapshot(result.keyword, now, result.competitorHarvest)
    );
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
