import type { GeoGridLocalPackEntry, GeoGridPoint } from "@/audit/types";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import {
  extractCompetitors,
  findBusinessRank,
  type BusinessMatchOptions,
} from "@/lib/google/local-rankings";
import { milesToMeters, searchPlacesSafe, type GeoLocation, type PlaceResult } from "@/lib/google/places";

export type GridProfileKey = "compact" | "standard" | "extended";

export const GRID_PROFILES = {
  compact: { size: 5, spacing: 0.35 },
  standard: { size: 7, spacing: 0.5 },
  extended: { size: 9, spacing: 0.75 },
} as const;

/** @deprecated use GRID_PROFILES.compact */
export const GEO_GRID_SIZE = GRID_PROFILES.compact.size;
/** @deprecated use GRID_PROFILES.compact */
export const GEO_GRID_SPACING_MILES = GRID_PROFILES.compact.spacing;

const GRID_SEARCH_RADIUS_MILES = 1;
/** Parallel Places searches per keyword grid (balance speed vs rate limits). */
const GRID_SEARCH_CONCURRENCY = 6;

export interface GridOffset {
  northMiles: number;
  eastMiles: number;
}

export function resolveGridProfile(profile: GridProfileKey = "compact") {
  return GRID_PROFILES[profile];
}

/** Symmetric N×N grid offsets centered on the business. */
export function buildGeoGridOffsets(
  size: number = GRID_PROFILES.compact.size,
  spacingMiles: number = GRID_PROFILES.compact.spacing
): GridOffset[] {
  const half = Math.floor(size / 2);
  const offsets: GridOffset[] = [];

  for (let row = -half; row <= half; row++) {
    for (let col = -half; col <= half; col++) {
      offsets.push({
        northMiles: row * spacingMiles,
        eastMiles: col * spacingMiles,
      });
    }
  }

  return offsets;
}

/** Offset a lat/lng by north/east miles (flat-earth approximation). */
export function offsetLocation(
  center: GeoLocation,
  northMiles: number,
  eastMiles: number
): GeoLocation {
  const latPerMile = 1 / 69;
  const lngPerMile = 1 / (69 * Math.cos((center.lat * Math.PI) / 180));
  return {
    lat: center.lat + northMiles * latPerMile,
    lng: center.lng + eastMiles * lngPerMile,
  };
}

function toLocalPackEntries(
  results: PlaceResult[],
  matchOptions: BusinessMatchOptions
): GeoGridLocalPackEntry[] {
  return extractCompetitors(results, matchOptions, 3).map((place) => ({
    placeId: place.placeId,
    name: place.name,
    position: place.position,
    rating: place.rating,
    reviewCount: place.reviewCount,
  }));
}

export interface CollectGeoGridOptions {
  profile?: GridProfileKey;
  includeLocalPack?: boolean;
  /** Nearby Search radius from each grid cell (default 1 mi). */
  searchRadiusMiles?: number;
}

/**
 * Collect rank at each grid point for one keyword (simulates local search from that area).
 */
export async function collectKeywordGeoGrid(
  keyword: string,
  center: GeoLocation,
  matchOptions: BusinessMatchOptions,
  options: CollectGeoGridOptions = {}
): Promise<GeoGridPoint[]> {
  const { size, spacing } = resolveGridProfile(options.profile ?? "compact");
  const offsets = buildGeoGridOffsets(size, spacing);
  const searchRadiusMiles = options.searchRadiusMiles ?? GRID_SEARCH_RADIUS_MILES;
  const searchRadius = milesToMeters(searchRadiusMiles);
  const includeLocalPack = options.includeLocalPack !== false;

  return mapWithConcurrency(offsets, GRID_SEARCH_CONCURRENCY, async ({ northMiles, eastMiles }) => {
    const point = offsetLocation(center, northMiles, eastMiles);
    const results = await searchPlacesSafe(keyword, point, searchRadius, "nearby");
    const rank = findBusinessRank(results, matchOptions);

    const cell: GeoGridPoint = {
      lat: point.lat,
      lng: point.lng,
      offsetNorthMiles: northMiles,
      offsetEastMiles: eastMiles,
      rank,
      inLocalPack: rank !== null && rank <= 3,
    };

    if (includeLocalPack) {
      cell.localPack = toLocalPackEntries(results, matchOptions);
    }

    return cell;
  });
}

const DEMO_COMPETITORS = [
  { name: "Joe's Plumbing", rating: 4.9, reviewCount: 312 },
  { name: "ABC Drain Co", rating: 4.7, reviewCount: 189 },
  { name: "Quick Fix LLC", rating: 4.6, reviewCount: 94 },
];

/** Demo grid with rank drift by distance from center. */
export function buildDemoGeoGrid(
  center: GeoLocation,
  baseRank: number,
  profile: GridProfileKey = "compact",
  searchRadiusMiles = GRID_SEARCH_RADIUS_MILES
): GeoGridPoint[] {
  const { size, spacing } = resolveGridProfile(profile);
  const radiusScale = searchRadiusMiles / GRID_SEARCH_RADIUS_MILES;
  return buildGeoGridOffsets(size, spacing).map(({ northMiles, eastMiles }) => {
    const dist = Math.sqrt(northMiles ** 2 + eastMiles ** 2);
    const drift = Math.round(dist * 2.5 * radiusScale);
    const rank =
      baseRank === 0
        ? null
        : Math.min(20, Math.max(1, baseRank + (northMiles === 0 && eastMiles === 0 ? 0 : drift)));
    const point = offsetLocation(center, northMiles, eastMiles);
    const weak = rank === null || rank > 3;

    return {
      lat: point.lat,
      lng: point.lng,
      offsetNorthMiles: northMiles,
      offsetEastMiles: eastMiles,
      rank,
      inLocalPack: rank !== null && rank <= 3,
      localPack: weak
        ? DEMO_COMPETITORS.map((c, i) => ({
            placeId: `demo-${i}`,
            name: c.name,
            position: i + 1,
            rating: c.rating,
            reviewCount: c.reviewCount,
          }))
        : [],
    };
  });
}
