import type { FullAuditPayload } from "@/audit/types";
import type { RankSnapshotRow, ScoreDailySnapshot } from "@/audit/types/timeseries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";

function rowToSnapshot(row: Record<string, unknown>): ScoreDailySnapshot {
  return {
    businessId: row.business_id as string,
    date: row.date as string,
    overall: row.overall as number,
    visibility: row.visibility as number,
    conversion: row.conversion as number,
    revenueCapture: row.revenue_capture as number,
    source: row.source as ScoreDailySnapshot["source"],
  };
}

export async function upsertScoreDaily(snapshot: ScoreDailySnapshot): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("score_daily").upsert(
    {
      business_id: snapshot.businessId,
      date: snapshot.date,
      overall: snapshot.overall,
      visibility: snapshot.visibility,
      conversion: snapshot.conversion,
      revenue_capture: snapshot.revenueCapture,
      source: snapshot.source,
    },
    { onConflict: "business_id,date" }
  );

  if (error) throw new Error(`Failed to upsert score_daily: ${error.message}`);
}

export async function listScoreDailyForUser(
  userId: string,
  businessSlug: string,
  days = 30
): Promise<ScoreDailySnapshot[]> {
  const supabase = await createClient();
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return [];

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  const { data, error } = await supabase
    .from("score_daily")
    .select("business_id, date, overall, visibility, conversion, revenue_capture, source")
    .eq("business_id", businessId)
    .gte("date", start.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => rowToSnapshot(row as Record<string, unknown>));
}

export async function listRankSnapshotsForBusinessDate(
  businessId: string,
  date: string
): Promise<RankSnapshotRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rank_snapshots")
    .select(
      "business_id, keyword, date, distance_miles, grid_north, grid_east, rank, in_local_pack, local_pack_position, source"
    )
    .eq("business_id", businessId)
    .eq("date", date)
    .eq("distance_miles", 1)
    .eq("grid_north", 0)
    .eq("grid_east", 0);

  if (error || !data) return [];

  return data.map((row) => ({
    businessId: row.business_id as string,
    keyword: row.keyword as string,
    date: row.date as string,
    distanceMiles: row.distance_miles as number,
    gridNorth: Number(row.grid_north),
    gridEast: Number(row.grid_east),
    rank: row.rank as number | null,
    inLocalPack: row.in_local_pack as boolean,
    localPackPosition: row.local_pack_position as number | null,
    source: row.source as RankSnapshotRow["source"],
  }));
}

export async function loadLatestAuditForBusinessAdmin(
  businessId: string
): Promise<FullAuditPayload | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audit_runs")
    .select("payload")
    .eq("business_id", businessId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) return null;
  return data.payload as FullAuditPayload;
}
