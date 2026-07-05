import type { GeoGridPoint } from "@/audit/types";
import type { RankSnapshotRow } from "@/audit/types/timeseries";
import { GEO_GRID_SPACING_MILES, GEO_GRID_SIZE } from "@/lib/google/geo-grid";

/** Share of grid cells in the Local 3-Pack (0–100). */
export function gridCoveragePercent(geoGrid: GeoGridPoint[]): number {
  if (geoGrid.length === 0) return 0;
  const inPack = geoGrid.filter((p) => p.inLocalPack).length;
  return Math.round((inPack / geoGrid.length) * 100);
}

export function geoGridToRankRows(params: {
  businessId: string;
  keyword: string;
  date: string;
  geoGrid: GeoGridPoint[];
  source: RankSnapshotRow["source"];
}): RankSnapshotRow[] {
  return params.geoGrid.map((point) => ({
    businessId: params.businessId,
    keyword: params.keyword,
    date: params.date,
    distanceMiles: 1,
    gridNorth: point.offsetNorthMiles,
    gridEast: point.offsetEastMiles,
    rank: point.rank,
    inLocalPack: point.inLocalPack,
    localPackPosition: point.inLocalPack && point.rank != null ? point.rank : null,
    source: params.source,
  }));
}

export function rankRowsToGeoGrid(
  rows: Array<{
    grid_north: number;
    grid_east: number;
    rank: number | null;
    in_local_pack: boolean;
    lat?: number;
    lng?: number;
  }>,
  center?: { lat: number; lng: number }
): GeoGridPoint[] {
  const latPerMile = center ? 1 / 69 : 0;
  const lngPerMile = center ? 1 / (69 * Math.cos((center.lat * Math.PI) / 180)) : 0;

  return rows.map((row) => {
    const north = Number(row.grid_north);
    const east = Number(row.grid_east);
    return {
      lat: center ? center.lat + north * latPerMile : 0,
      lng: center ? center.lng + east * lngPerMile : 0,
      offsetNorthMiles: north,
      offsetEastMiles: east,
      rank: row.rank,
      inLocalPack: row.in_local_pack,
    };
  });
}

export const DEFAULT_GRID_META = {
  gridSize: GEO_GRID_SIZE,
  spacingMiles: GEO_GRID_SPACING_MILES,
};
