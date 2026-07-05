import type { GeoGridPoint } from "@/audit/types";
import type { RankSnapshotRow } from "@/audit/types/timeseries";
import { resolveGridProfile, type GridProfileKey } from "@/lib/google/geo-grid";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";

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

/** Infer grid size/spacing from collected cell offsets. */
export function inferGridMetaFromPoints(geoGrid: GeoGridPoint[]): {
  gridSize: number;
  spacingMiles: number;
} {
  if (geoGrid.length === 0) {
    const { size, spacing } = resolveGridProfile(HEATMAP_FLAGS.gridProfile as GridProfileKey);
    return { gridSize: size, spacingMiles: spacing };
  }

  const gridSize = Math.round(Math.sqrt(geoGrid.length));
  const spacingSamples = new Set<number>();

  for (const point of geoGrid) {
    if (point.offsetNorthMiles !== 0) {
      spacingSamples.add(Math.abs(point.offsetNorthMiles));
    }
    if (point.offsetEastMiles !== 0) {
      spacingSamples.add(Math.abs(point.offsetEastMiles));
    }
  }

  const spacingMiles =
    spacingSamples.size > 0
      ? Math.min(...spacingSamples)
      : resolveGridProfile(HEATMAP_FLAGS.gridProfile as GridProfileKey).spacing;

  return { gridSize, spacingMiles };
}

export const DEFAULT_GRID_META = inferGridMetaFromPoints([]);
