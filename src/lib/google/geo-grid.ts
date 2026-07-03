import type { GeoGridPoint } from "@/audit/types";
import { findBusinessRank, type BusinessMatchOptions } from "@/lib/google/local-rankings";
import { milesToMeters, searchPlaces, type GeoLocation } from "@/lib/google/places";

/** 5×5 grid — balances coverage with API cost (25 searches per keyword). */
export const GEO_GRID_SIZE = 5;
export const GEO_GRID_SPACING_MILES = 0.35;
const GRID_SEARCH_RADIUS_MILES = 1;

export interface GridOffset {
  northMiles: number;
  eastMiles: number;
}

/** Symmetric N×N grid offsets centered on the business. */
export function buildGeoGridOffsets(size = GEO_GRID_SIZE): GridOffset[] {
  const half = Math.floor(size / 2);
  const offsets: GridOffset[] = [];

  for (let row = -half; row <= half; row++) {
    for (let col = -half; col <= half; col++) {
      offsets.push({
        northMiles: row * GEO_GRID_SPACING_MILES,
        eastMiles: col * GEO_GRID_SPACING_MILES,
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

/**
 * Collect rank at each grid point for one keyword (simulates local search from that area).
 */
export async function collectKeywordGeoGrid(
  keyword: string,
  center: GeoLocation,
  matchOptions: BusinessMatchOptions
): Promise<GeoGridPoint[]> {
  const offsets = buildGeoGridOffsets();
  const searchRadius = milesToMeters(GRID_SEARCH_RADIUS_MILES);
  const grid: GeoGridPoint[] = [];

  for (const { northMiles, eastMiles } of offsets) {
    const point = offsetLocation(center, northMiles, eastMiles);
    const results = await searchPlaces(keyword, point, searchRadius, "nearby");
    const rank = findBusinessRank(results, matchOptions);

    grid.push({
      lat: point.lat,
      lng: point.lng,
      offsetNorthMiles: northMiles,
      offsetEastMiles: eastMiles,
      rank,
      inLocalPack: rank !== null && rank <= 3,
    });
  }

  return grid;
}

/** Demo grid with rank drift by distance from center. */
export function buildDemoGeoGrid(center: GeoLocation, baseRank: number): GeoGridPoint[] {
  return buildGeoGridOffsets().map(({ northMiles, eastMiles }) => {
    const dist = Math.sqrt(northMiles ** 2 + eastMiles ** 2);
    const drift = Math.round(dist * 2.5);
    const rank =
      baseRank === 0
        ? null
        : Math.min(20, Math.max(1, baseRank + (northMiles === 0 && eastMiles === 0 ? 0 : drift)));
    const point = offsetLocation(center, northMiles, eastMiles);

    return {
      lat: point.lat,
      lng: point.lng,
      offsetNorthMiles: northMiles,
      offsetEastMiles: eastMiles,
      rank,
      inLocalPack: rank !== null && rank <= 3,
    };
  });
}
