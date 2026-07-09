import type { GeoGridPoint, KeywordRankSnapshot, RankSnapshot } from "@/audit/types";
import type { RankSnapshotRow } from "@/audit/types/timeseries";
import {
  geoGridToRankRows,
  gridCoveragePercent,
  inferGridMetaFromPoints,
  rankRowsToGeoGrid,
} from "@/audit/geo/grid-coverage";
import { attachLocalPackToGrid, loadCellLeadersForDate, upsertCellLeaders } from "@/audit/storage-cell-leaders";
import { upsertRankSnapshots } from "@/audit/storage-timeseries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";

export interface GridSnapshotMeta {
  date: string;
  coveragePercent: number;
  cellsTotal: number;
  cellsInPack: number;
  source: string;
  triggerTaskId?: string | null;
}

function gridMetaToDb(params: {
  businessId: string;
  keyword: string;
  date: string;
  geoGrid: GeoGridPoint[];
  source: string;
  triggerTaskId?: string | null;
}) {
  const cellsInPack = params.geoGrid.filter((p) => p.inLocalPack).length;
  const { gridSize, spacingMiles } = inferGridMetaFromPoints(params.geoGrid);
  return {
    business_id: params.businessId,
    keyword: params.keyword,
    date: params.date,
    grid_size: gridSize,
    spacing_miles: spacingMiles,
    cells_total: params.geoGrid.length,
    cells_in_pack: cellsInPack,
    coverage_percent: gridCoveragePercent(params.geoGrid),
    source: params.source,
    trigger_task_id: params.triggerTaskId ?? null,
  };
}

/** Persist a full geo grid to rank_snapshots + grid_snapshots metadata. */
export async function upsertGridSnapshot(params: {
  businessId: string;
  keyword: string;
  date: string;
  geoGrid: GeoGridPoint[];
  source: "audit" | "weekly" | "task_trigger" | "audit_backfill";
  triggerTaskId?: string | null;
  rankSource?: RankSnapshotRow["source"];
}): Promise<void> {
  if (params.geoGrid.length === 0) return;

  const supabase = createAdminClient();
  const rankSource: RankSnapshotRow["source"] =
    params.rankSource ?? (params.source === "audit" ? "audit_backfill" : "api");

  const rankRows = geoGridToRankRows({
    businessId: params.businessId,
    keyword: params.keyword,
    date: params.date,
    geoGrid: params.geoGrid,
    source: rankSource,
  });

  await upsertRankSnapshots(rankRows);
  await upsertCellLeaders({
    businessId: params.businessId,
    keyword: params.keyword,
    date: params.date,
    geoGrid: params.geoGrid,
  });

  const { error } = await supabase.from("grid_snapshots").upsert(gridMetaToDb(params), {
    onConflict: "business_id,keyword,date",
  });

  if (error) {
    throw new Error(`Failed to upsert grid_snapshots: ${error.message}`);
  }
}

/** Persist all keyword grids from an audit run. */
export async function persistAuditGridToTimeseries(
  businessId: string,
  rankings: RankSnapshot,
  auditDate: string
): Promise<number> {
  let count = 0;
  for (const kw of rankings.keywords) {
    if (!kw.geoGrid?.length) continue;
    await upsertGridSnapshot({
      businessId,
      keyword: kw.keyword,
      date: auditDate,
      geoGrid: kw.geoGrid,
      source: "audit",
      rankSource: "audit_backfill",
    });
    count += 1;
  }
  return count;
}

export async function listGridSnapshotDatesAdmin(
  businessId: string,
  keyword: string,
  limit = 12
): Promise<GridSnapshotMeta[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("grid_snapshots")
    .select("date, coverage_percent, cells_total, cells_in_pack, source, trigger_task_id")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .order("date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    date: row.date as string,
    coveragePercent: Number(row.coverage_percent),
    cellsTotal: Number(row.cells_total),
    cellsInPack: Number(row.cells_in_pack),
    source: row.source as string,
    triggerTaskId: (row.trigger_task_id as string) ?? null,
  }));
}

export async function listGridSnapshotDatesForUser(
  userId: string,
  businessSlug: string,
  keyword: string,
  limit = 12
): Promise<GridSnapshotMeta[]> {
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return [];
  return listGridSnapshotDatesAdmin(businessId, keyword, limit);
}

export async function loadGridForDateAdmin(
  businessId: string,
  keyword: string,
  date: string,
  center?: { lat: number; lng: number }
): Promise<GeoGridPoint[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rank_snapshots")
    .select("grid_north, grid_east, rank, in_local_pack")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .eq("date", date)
    .eq("distance_miles", 1);

  if (error || !data?.length) return [];

  // Daily ingest stores only center (0,0); full grids have multiple cells.
  if (data.length === 1) return [];

  const grid = rankRowsToGeoGrid(
    data.map((r) => ({
      grid_north: Number(r.grid_north),
      grid_east: Number(r.grid_east),
      rank: r.rank as number | null,
      in_local_pack: r.in_local_pack as boolean,
    })),
    center
  );

  const leaders = await loadCellLeadersForDate(businessId, keyword, date);
  return attachLocalPackToGrid(grid, leaders);
}

export async function loadGridForDateForUser(
  userId: string,
  businessSlug: string,
  keyword: string,
  date: string,
  center?: { lat: number; lng: number }
): Promise<GeoGridPoint[]> {
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return [];
  return loadGridForDateAdmin(businessId, keyword, date, center);
}

/** Latest geo-grid per keyword on or before a date — for daily score overlay. */
export async function loadLatestKeywordGridsAdmin(
  businessId: string,
  keywords: string[],
  onOrBeforeDate: string
): Promise<Map<string, GeoGridPoint[]>> {
  const result = new Map<string, GeoGridPoint[]>();
  if (keywords.length === 0) return result;

  const supabase = createAdminClient();

  for (const keyword of keywords) {
    const { data, error } = await supabase
      .from("grid_snapshots")
      .select("date, cells_total")
      .eq("business_id", businessId)
      .eq("keyword", keyword)
      .lte("date", onOrBeforeDate)
      .gt("cells_total", 1)
      .order("date", { ascending: false })
      .limit(1);

    if (error || !data?.[0]?.date) continue;

    const grid = await loadGridForDateAdmin(
      businessId,
      keyword,
      data[0].date as string
    );
    if (grid.length > 0) {
      result.set(keyword, grid);
    }
  }

  return result;
}

/** Latest stored geo-grid for a keyword (weekly ingest or audit), for map display. */
export async function loadLatestKeywordGridForUser(
  userId: string,
  businessSlug: string,
  keyword: string,
  onOrBeforeDate?: string
): Promise<{ date: string; geoGrid: GeoGridPoint[]; source: string } | null> {
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return null;

  const targetDate = onOrBeforeDate ?? new Date().toISOString().slice(0, 10);
  const grids = await loadLatestKeywordGridsAdmin(businessId, [keyword], targetDate);
  const geoGrid = grids.get(keyword) ?? grids.get(keyword.toLowerCase());
  if (!geoGrid?.length) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("grid_snapshots")
    .select("date, source")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .lte("date", targetDate)
    .gt("cells_total", 1)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    date: (data?.date as string) ?? targetDate,
    geoGrid,
    source: (data?.source as string) ?? "weekly",
  };
}

export async function listCoverageTrendForUser(
  userId: string,
  businessSlug: string,
  keyword: string,
  days = 90
): Promise<Array<{ date: string; coveragePercent: number }>> {
  const supabase = await createClient();
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return [];

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  const { data, error } = await supabase
    .from("grid_snapshots")
    .select("date, coverage_percent")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .gte("date", start.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    date: row.date as string,
    coveragePercent: Number(row.coverage_percent),
  }));
}

/** Nearest grid coverage on or before a date (for attribution windows). */
export async function gridCoverageNearDateAdmin(
  businessId: string,
  keyword: string,
  targetDate: string,
  direction: "before" | "after"
): Promise<{ date: string; coveragePercent: number } | null> {
  const supabase = createAdminClient();
  let query = supabase
    .from("grid_snapshots")
    .select("date, coverage_percent")
    .eq("business_id", businessId)
    .eq("keyword", keyword);

  if (direction === "before") {
    query = query.lte("date", targetDate).order("date", { ascending: false });
  } else {
    query = query.gte("date", targetDate).order("date", { ascending: true });
  }

  const { data, error } = await query.limit(1);
  if (error || !data?.[0]) return null;

  return {
    date: data[0].date as string,
    coveragePercent: Number(data[0].coverage_percent),
  };
}

export async function shouldRefreshGridAfterTask(
  businessId: string,
  keyword: string,
  debounceHours = 48
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("grid_snapshots")
    .select("created_at")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .in("source", ["weekly", "task_trigger", "audit"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (!data?.[0]?.created_at) return true;

  const last = new Date(data[0].created_at as string).getTime();
  const debounceMs = debounceHours * 60 * 60 * 1000;
  return Date.now() - last >= debounceMs;
}

function addDaysYmd(date: Date, days: number): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Reuse a stored geo-grid when a full snapshot exists within maxAgeDays. */
export async function loadFreshKeywordGridAdmin(
  businessId: string,
  keyword: string,
  maxAgeDays: number
): Promise<GeoGridPoint[] | null> {
  if (maxAgeDays <= 0) return null;

  const minDate = addDaysYmd(new Date(), -maxAgeDays);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("grid_snapshots")
    .select("date")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .gte("date", minDate)
    .gt("cells_total", 1)
    .order("date", { ascending: false })
    .limit(1);

  if (error || !data?.[0]?.date) return null;

  const grid = await loadGridForDateAdmin(businessId, keyword, data[0].date as string);
  return grid.length > 0 ? grid : null;
}

export async function persistKeywordGridFromCollection(
  businessId: string,
  keyword: string,
  geoGrid: GeoGridPoint[],
  source: "weekly" | "task_trigger",
  triggerTaskId?: string | null
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await upsertGridSnapshot({
    businessId,
    keyword,
    date,
    geoGrid,
    source,
    triggerTaskId,
  });
}

export function keywordHasGrid(kw: KeywordRankSnapshot): boolean {
  return Boolean(kw.geoGrid && kw.geoGrid.length > 0);
}
