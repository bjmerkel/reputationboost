import type {
  IngestRunResult,
  PerformanceDailyRow,
  RankSnapshotRow,
  DailyMetricPoint,
} from "@/audit/types/timeseries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";

function performanceRowToDb(row: PerformanceDailyRow) {
  return {
    business_id: row.businessId,
    date: row.date,
    metric: row.metric,
    value: row.value,
    source: row.source,
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

export async function listRankTrendForUser(
  userId: string,
  businessSlug: string,
  keyword: string,
  days = 90
): Promise<Array<{ date: string; rank: number | null }>> {
  const supabase = await createClient();
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return [];

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  const { data, error } = await supabase
    .from("rank_snapshots")
    .select("date, rank")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .eq("distance_miles", 1)
    .eq("grid_north", 0)
    .eq("grid_east", 0)
    .gte("date", start.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    date: row.date as string,
    rank: row.rank as number | null,
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
