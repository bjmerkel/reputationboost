import type { GeoGridLocalPackEntry, GeoGridPoint } from "@/audit/types";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import {
  extractCompetitors,
  findBusinessRank,
  type BusinessMatchOptions,
} from "@/lib/google/local-rankings";
import { milesToMeters, searchPlacesSafe, type GeoLocation, type PlaceResult } from "@/lib/google/places";
import {
  buildRadialSearchOrigins,
  type RadialSearchOrigin,
} from "@/lib/google/radial-rankings";

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
  /** @deprecated Radial-v2 always collects the fixed 25-point profile. */
  profile?: GridProfileKey;
  includeLocalPack?: boolean;
  /** Soft Text Search location-bias radius from each sample (default 1 mi). */
  searchRadiusMiles?: number;
}

/**
 * Collect one business-pin sample and eight Text Search samples on each 1/3/5-mile ring.
 */
export async function collectKeywordGeoGrid(
  keyword: string,
  center: GeoLocation,
  matchOptions: BusinessMatchOptions,
  options: CollectGeoGridOptions = {}
): Promise<GeoGridPoint[]> {
  const searchRadiusMiles = options.searchRadiusMiles ?? GRID_SEARCH_RADIUS_MILES;
  const searchRadius = milesToMeters(searchRadiusMiles);
  const includeLocalPack = options.includeLocalPack !== false;
  const origins = buildRadialSearchOrigins(center);

  return mapWithConcurrency(origins, GRID_SEARCH_CONCURRENCY, async (origin) => {
    const results = await searchPlacesSafe(keyword, origin.location, searchRadius, "text", {
      maxPages: 1,
      rankFieldsOnly: true,
    });
    const rank = findBusinessRank(results, matchOptions);

    const cell: GeoGridPoint = {
      lat: origin.location.lat,
      lng: origin.location.lng,
      offsetNorthMiles: origin.offsetNorthMiles,
      offsetEastMiles: origin.offsetEastMiles,
      rank,
      inLocalPack: rank !== null && rank <= 3,
      sampleDistanceMiles: origin.distanceMiles,
      sampleDirection: origin.direction,
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

function demoRankAtOrigin(baseRank: number, origin: RadialSearchOrigin): number | null {
  if (baseRank === 0) return null;
  const directionDrift =
    origin.direction === "center"
      ? 0
      : ["N", "NE", "E", "SE"].includes(origin.direction)
        ? 1
        : 2;
  return Math.min(20, Math.max(1, baseRank + Math.round(origin.distanceMiles * 0.8) + directionDrift));
}

/** Demo radial visibility samples with rank drift by distance and direction. */
export function buildDemoGeoGrid(
  center: GeoLocation,
  baseRank: number,
  _profile: GridProfileKey = "compact",
  _searchRadiusMiles = GRID_SEARCH_RADIUS_MILES
): GeoGridPoint[] {
  return buildRadialSearchOrigins(center).map((origin) => {
    const rank = demoRankAtOrigin(baseRank, origin);
    const weak = rank === null || rank > 3;

    return {
      lat: origin.location.lat,
      lng: origin.location.lng,
      offsetNorthMiles: origin.offsetNorthMiles,
      offsetEastMiles: origin.offsetEastMiles,
      rank,
      inLocalPack: rank !== null && rank <= 3,
      sampleDistanceMiles: origin.distanceMiles,
      sampleDirection: origin.direction,
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
