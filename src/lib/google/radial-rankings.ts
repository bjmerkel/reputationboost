import type { GeoGridPoint, GeoRankPoint } from "@/audit/types";
import type { GeoLocation } from "./places";

export const RADIAL_RING_MILES = [1, 3, 5] as const;
export type RadialRingMiles = (typeof RADIAL_RING_MILES)[number];

export const RADIAL_DIRECTIONS = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
] as const;
export type RadialDirection = (typeof RADIAL_DIRECTIONS)[number];
export type RadialSampleDirection = "center" | RadialDirection;

const EARTH_RADIUS_MILES = 3958.7613;
const NOT_VISIBLE_RANK = 21;
const DISTANCE_TOLERANCE_MILES = 0.03;

const BEARING_DEGREES: Record<RadialDirection, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

export interface RadialSearchOrigin {
  distanceMiles: 0 | RadialRingMiles;
  direction: RadialSampleDirection;
  bearingDegrees: number;
  offsetNorthMiles: number;
  offsetEastMiles: number;
  location: GeoLocation;
}

export interface RadialRankSummary {
  centerRank: number | null;
  centerInTop3: boolean;
  rings: GeoRankPoint[];
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Destination point on a sphere, avoiding diagonal and latitude scaling errors. */
export function destinationLocation(
  center: GeoLocation,
  distanceMiles: number,
  bearingDegrees: number
): GeoLocation {
  if (distanceMiles === 0) return { ...center };

  const angularDistance = distanceMiles / EARTH_RADIUS_MILES;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(center.lat);
  const lng1 = toRadians(center.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: toDegrees(lat2),
    lng: ((toDegrees(lng2) + 540) % 360) - 180,
  };
}

/** Business pin plus eight equally spaced bearings at 1, 3, and 5 miles. */
export function buildRadialSearchOrigins(center: GeoLocation): RadialSearchOrigin[] {
  const origins: RadialSearchOrigin[] = [
    {
      distanceMiles: 0,
      direction: "center",
      bearingDegrees: 0,
      offsetNorthMiles: 0,
      offsetEastMiles: 0,
      location: { ...center },
    },
  ];

  for (const distanceMiles of RADIAL_RING_MILES) {
    for (const direction of RADIAL_DIRECTIONS) {
      const bearingDegrees = BEARING_DEGREES[direction];
      const bearing = toRadians(bearingDegrees);
      origins.push({
        distanceMiles,
        direction,
        bearingDegrees,
        offsetNorthMiles: Number((distanceMiles * Math.cos(bearing)).toFixed(3)),
        offsetEastMiles: Number((distanceMiles * Math.sin(bearing)).toFixed(3)),
        location: destinationLocation(center, distanceMiles, bearingDegrees),
      });
    }
  }

  return origins;
}

function sampleDistance(point: GeoGridPoint): number {
  return (
    point.sampleDistanceMiles ??
    Math.sqrt(point.offsetNorthMiles ** 2 + point.offsetEastMiles ** 2)
  );
}

export function isRadialRankGrid(grid: GeoGridPoint[]): boolean {
  if (grid.length !== 25) return false;
  const centerCount = grid.filter((point) => sampleDistance(point) < DISTANCE_TOLERANCE_MILES).length;
  if (centerCount !== 1) return false;

  return RADIAL_RING_MILES.every(
    (ring) =>
      grid.filter((point) => Math.abs(sampleDistance(point) - ring) < DISTANCE_TOLERANCE_MILES)
        .length === 8
  );
}

export function radialDirectionForOffset(
  northMiles: number,
  eastMiles: number
): RadialSampleDirection {
  const distance = Math.sqrt(northMiles ** 2 + eastMiles ** 2);
  if (distance < DISTANCE_TOLERANCE_MILES) return "center";
  const bearing = (toDegrees(Math.atan2(eastMiles, northMiles)) + 360) % 360;
  const index = Math.round(bearing / 45) % RADIAL_DIRECTIONS.length;
  return RADIAL_DIRECTIONS[index]!;
}

function aggregateRing(points: GeoGridPoint[], distanceMiles: RadialRingMiles): GeoRankPoint {
  if (points.length === 0) {
    return {
      distanceMiles,
      rank: null,
      inLocalPack: false,
      sampleCount: 0,
      inLocalPackCount: 0,
      visibleCount: 0,
      bestRank: null,
      worstRank: null,
    };
  }

  const numericRanks = points
    .map((point) => point.rank)
    .filter((rank): rank is number => rank != null);
  const rankedForMedian = points
    .map((point) => point.rank ?? NOT_VISIBLE_RANK)
    .sort((a, b) => a - b);
  const middle = rankedForMedian.length / 2;
  const median =
    rankedForMedian.length % 2 === 0
      ? Math.round((rankedForMedian[middle - 1]! + rankedForMedian[middle]!) / 2)
      : rankedForMedian[Math.floor(middle)]!;
  const rank = median > 20 ? null : median;
  const inLocalPackCount = points.filter((point) => point.rank != null && point.rank <= 3).length;

  return {
    distanceMiles,
    rank,
    inLocalPack: rank != null && rank <= 3,
    sampleCount: points.length,
    inLocalPackCount,
    visibleCount: numericRanks.length,
    bestRank: numericRanks.length ? Math.min(...numericRanks) : null,
    worstRank: numericRanks.length ? Math.max(...numericRanks) : null,
  };
}

/** Aggregate eight samples per ring while keeping the business-pin result separate. */
export function summarizeRadialRanks(grid: GeoGridPoint[]): RadialRankSummary {
  const center = grid.find((point) => sampleDistance(point) < DISTANCE_TOLERANCE_MILES);
  const centerRank = center?.rank ?? null;

  return {
    centerRank,
    centerInTop3: centerRank != null && centerRank <= 3,
    rings: RADIAL_RING_MILES.map((distanceMiles) => {
      const points = grid.filter(
        (point) => Math.abs(sampleDistance(point) - distanceMiles) < DISTANCE_TOLERANCE_MILES
      );
      return aggregateRing(points, distanceMiles);
    }),
  };
}
