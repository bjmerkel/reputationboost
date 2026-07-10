import type {
  IngestRunResult,
  PerformanceDailyRow,
  PerformanceIngestMeta,
  RankSnapshotRow,
  DailyMetricPoint,
} from "@/audit/types/timeseries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";
import {
  RADIAL_RANKING_CUTOVER_DATE,
  RADIAL_RING_MILES,
} from "@/lib/google/radial-rankings";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";

function performanceRowToDb(row: PerformanceDailyRow) {
  return {
    business_id: row.businessId,
    date: row.date,
    metric: row.metric,
    value: row.value,
    source: row.source,
    created_at: new Date().toISOString(),
  };
}

function rankRowToDb(row: RankSnapshotRow) {
  return {
    business_id: row.businessId,
    keyword: row.keyword,
    date: row.date,
    distance_miles: row.distanceMiles,
    grid_north: row.gridNorth,
    grid_east: row.gridEast,
    rank: row.rank,
    in_local_pack: row.inLocalPack,
    local_pack_position: row.localPackPosition,
    source: row.source,
  };
}

export async function upsertPerformanceDaily(rows: PerformanceDailyRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("performance_daily")
    .upsert(rows.map(performanceRowToDb), { onConflict: "business_id,date,metric" });

  if (error) throw new Error(`Failed to upsert performance_daily: ${error.message}`);
  return rows.length;
}

export async function upsertRankSnapshots(rows: RankSnapshotRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const supabase = createAdminClient();
  const { error } = await supabase.from("rank_snapshots").upsert(
    rows.map(rankRowToDb),
    { onConflict: "business_id,keyword,date,distance_miles,grid_north,grid_east" }
  );

  if (error) throw new Error(`Failed to upsert rank_snapshots: ${error.message}`);
  return rows.length;
}

export async function listPerformanceDailyForUser(
  userId: string,
  businessSlug: string,
  days = 30
): Promise<DailyMetricPoint[]> {
  const supabase = await createClient();
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return [];

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  const { data, error } = await supabase
    .from("performance_daily")
    .select("date, metric, value")
    .eq("business_id", businessId)
    .gte("date", start.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    date: row.date as string,
    metric: row.metric as DailyMetricPoint["metric"],
    value: row.value as number,
  }));
}

const ACTION_METRICS = ["calls", "direction_requests", "website_clicks"] as const;

export async function getPerformanceIngestMetaForUser(
  userId: string,
  businessSlug: string
): Promise<PerformanceIngestMeta> {
  const supabase = await createClient();
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) {
    return { latestDataDate: null, lastIngestedAt: null };
  }

  const { data, error } = await supabase
    .from("performance_daily")
    .select("date, created_at")
    .eq("business_id", businessId)
    .in("metric", [...ACTION_METRICS])
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data || data.length === 0) {
    return { latestDataDate: null, lastIngestedAt: null };
  }

  const latestDataDate = data[0]?.date as string;
  const lastIngestedAt = data
    .filter((row) => row.date === latestDataDate)
    .map((row) => row.created_at as string)
    .sort()
    .at(-1) ?? null;

  return { latestDataDate, lastIngestedAt };
}

export interface RankTrendPoint {
  date: string;
  rank: number | null;
  distanceMiles: number;
}

export interface ListRankTrendOptions {
  /** When true, return weekly median ranks at the 1/3/5-mile sample rings. */
  multiRadius?: boolean;
  /** Filter to the business pin (0) or one sample ring. */
  radiusMiles?: number;
}

export async function listRankTrendForUser(
  userId: string,
  businessSlug: string,
  keyword: string,
  days = 90,
  options: ListRankTrendOptions = {}
): Promise<RankTrendPoint[]> {
  const multiRadius = options.multiRadius ?? HEATMAP_FLAGS.dailyMultiRadius;
  const supabase = await createClient();
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return [];

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  let query = supabase
    .from("rank_snapshots")
    .select("date, rank, distance_miles")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .eq("grid_north", 0)
    .eq("grid_east", 0)
    .gte("date", start.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (multiRadius) {
    query = query
      .in("distance_miles", [...RADIAL_RING_MILES])
      .gte("date", RADIAL_RANKING_CUTOVER_DATE);
  } else {
    const radiusMiles = options.radiusMiles ?? 0;
    query =
      radiusMiles === 0
        ? query.in("distance_miles", [0, 1])
        : query.eq("distance_miles", radiusMiles).gte("date", RADIAL_RANKING_CUTOVER_DATE);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data
    .filter((row) => {
      if (multiRadius || (options.radiusMiles ?? 0) !== 0) return true;
      const date = row.date as string;
      const distance = Number(row.distance_miles);
      return date < RADIAL_RANKING_CUTOVER_DATE ? distance === 1 : distance === 0;
    })
    .map((row) => ({
      date: row.date as string,
      rank: row.rank as number | null,
      distanceMiles:
        !multiRadius && (options.radiusMiles ?? 0) === 0
          ? 0
          : (row.distance_miles as number),
    }));
}

export async function startIngestRun(jobName: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ingest_runs")
    .insert({
      job_name: jobName,
      started_at: new Date().toISOString(),
      status: "running",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to start ingest run: ${error.message}`);
  return data.id as string;
}

export async function completeIngestRun(runId: string, result: IngestRunResult): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ingest_runs")
    .update({
      completed_at: new Date().toISOString(),
      businesses_processed: result.businessesProcessed,
      performance_rows_upserted: result.performanceRowsUpserted,
      rank_rows_upserted: result.rankRowsUpserted,
      errors: result.errors,
      status: result.errors.length > 0 ? "completed_with_errors" : "completed",
    })
    .eq("id", runId);

  if (error) throw new Error(`Failed to complete ingest run: ${error.message}`);
}

export async function failIngestRun(
  runId: string,
  result: IngestRunResult,
  message: string
): Promise<void> {
  const supabase = createAdminClient();
  const errors = [...result.errors, { businessId: "", step: "job", message }];
  const { error } = await supabase
    .from("ingest_runs")
    .update({
      completed_at: new Date().toISOString(),
      businesses_processed: result.businessesProcessed,
      performance_rows_upserted: result.performanceRowsUpserted,
      rank_rows_upserted: result.rankRowsUpserted,
      errors,
      status: "failed",
    })
    .eq("id", runId);

  if (error) throw new Error(`Failed to fail ingest run: ${error.message}`);
}
