import type { GeoGridLocalPackEntry, GeoGridPoint } from "@/audit/types";
import type { RankingModel } from "@/audit/types/timeseries";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CellLeaderRow {
  businessId: string;
  keyword: string;
  date: string;
  gridNorth: number;
  gridEast: number;
  position: number;
  placeId: string | null;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  rankingModel: RankingModel;
}

function geoGridToCellLeaderRows(params: {
  businessId: string;
  keyword: string;
  date: string;
  geoGrid: GeoGridPoint[];
  rankingModel: RankingModel;
}): CellLeaderRow[] {
  const rows: CellLeaderRow[] = [];

  for (const point of params.geoGrid) {
    if (!point.localPack?.length) continue;

    for (const entry of point.localPack) {
      rows.push({
        businessId: params.businessId,
        keyword: params.keyword,
        date: params.date,
        gridNorth: point.offsetNorthMiles,
        gridEast: point.offsetEastMiles,
        position: entry.position,
        placeId: entry.placeId ?? null,
        name: entry.name,
        rating: entry.rating ?? null,
        reviewCount: entry.reviewCount ?? null,
        rankingModel: params.rankingModel,
      });
    }
  }

  return rows;
}

function cellKey(north: number, east: number): string {
  return `${north.toFixed(3)}:${east.toFixed(3)}`;
}

export function attachLocalPackToGrid(
  grid: GeoGridPoint[],
  leaders: CellLeaderRow[]
): GeoGridPoint[] {
  if (leaders.length === 0) return grid;

  const byCell = new Map<string, GeoGridLocalPackEntry[]>();

  for (const row of leaders) {
    const key = cellKey(row.gridNorth, row.gridEast);
    const list = byCell.get(key) ?? [];
    list.push({
      placeId: row.placeId ?? `unknown-${row.position}`,
      name: row.name,
      position: row.position as 1 | 2 | 3,
      rating: row.rating,
      reviewCount: row.reviewCount ?? 0,
    });
    byCell.set(key, list);
  }

  for (const entries of byCell.values()) {
    entries.sort((a, b) => a.position - b.position);
  }

  return grid.map((point) => {
    const pack = byCell.get(cellKey(point.offsetNorthMiles, point.offsetEastMiles));
    if (!pack?.length) return point;
    return { ...point, localPack: pack };
  });
}

/** Persist per-cell local pack leaders alongside a grid snapshot. */
export async function upsertCellLeaders(params: {
  businessId: string;
  keyword: string;
  date: string;
  geoGrid: GeoGridPoint[];
  rankingModel: RankingModel;
}): Promise<void> {
  const rows = geoGridToCellLeaderRows(params);
  if (rows.length === 0) return;

  const supabase = createAdminClient();

  const { error: deleteError } = await supabase
    .from("rank_cell_leaders")
    .delete()
    .eq("business_id", params.businessId)
    .eq("keyword", params.keyword)
    .eq("date", params.date)
    .eq("ranking_model", params.rankingModel);

  if (deleteError) {
    throw new Error(`Failed to clear rank_cell_leaders: ${deleteError.message}`);
  }

  const { error } = await supabase.from("rank_cell_leaders").insert(
    rows.map((row) => ({
      business_id: row.businessId,
      keyword: row.keyword,
      date: row.date,
      grid_north: row.gridNorth,
      grid_east: row.gridEast,
      position: row.position,
      place_id: row.placeId,
      name: row.name,
      rating: row.rating,
      review_count: row.reviewCount,
      ranking_model: row.rankingModel,
    }))
  );

  if (error) {
    throw new Error(`Failed to upsert rank_cell_leaders: ${error.message}`);
  }
}

export async function loadCellLeadersForDate(
  businessId: string,
  keyword: string,
  date: string,
  rankingModel: RankingModel
): Promise<CellLeaderRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rank_cell_leaders")
    .select(
      "grid_north, grid_east, position, place_id, name, rating, review_count"
    )
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .eq("date", date)
    .eq("ranking_model", rankingModel);

  if (error || !data) return [];

  return data.map((row) => ({
    businessId,
    keyword,
    date,
    gridNorth: Number(row.grid_north),
    gridEast: Number(row.grid_east),
    position: Number(row.position),
    placeId: (row.place_id as string) ?? null,
    name: row.name as string,
    rating: row.rating != null ? Number(row.rating) : null,
    reviewCount: row.review_count != null ? Number(row.review_count) : null,
    rankingModel,
  }));
}
