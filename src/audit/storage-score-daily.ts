import type { FullAuditPayload } from "@/audit/types";
import type { RankSnapshotRow, ScoreDailySnapshot } from "@/audit/types/timeseries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";

const SCORE_DAILY_BASE_COLUMNS =
  "business_id, date, overall, visibility, conversion, revenue_capture, source";

const SCORE_DAILY_EXTENDED_COLUMNS =
  `${SCORE_DAILY_BASE_COLUMNS}, driver_score, outcome_index`;

function isMissingScoreDailyColumnError(message: string): boolean {
  return (
    message.includes("schema cache") &&
    (message.includes("driver_score") || message.includes("outcome_index"))
  );
}

export interface RankSnapshotQueryOptions {
  /** Aggregate rows only (grid 0,0) — excludes raw radial sample points. */
  centerPointOnly?: boolean;
  /** When true, include center plus 1/3/5-mile ring medians. */
  multiRadius?: boolean;
}

function rowToSnapshot(row: Record<string, unknown>): ScoreDailySnapshot {
  return {
    businessId: row.business_id as string,
    date: row.date as string,
    overall: row.overall as number,
    driverScore:
      row.driver_score != null ? Number(row.driver_score) : undefined,
    outcomeIndex:
      row.outcome_index != null ? Number(row.outcome_index) : undefined,
    visibility: row.visibility as number,
    conversion: row.conversion as number,
    revenueCapture: row.revenue_capture as number,
    source: row.source as ScoreDailySnapshot["source"],
  };
}

export async function upsertScoreDaily(snapshot: ScoreDailySnapshot): Promise<void> {
  const supabase = createAdminClient();
  const baseRow = {
    business_id: snapshot.businessId,
    date: snapshot.date,
    overall: snapshot.overall,
    visibility: snapshot.visibility,
    conversion: snapshot.conversion,
    revenue_capture: snapshot.revenueCapture,
    source: snapshot.source,
  };
  const extendedRow = {
    ...baseRow,
    driver_score: snapshot.driverScore ?? snapshot.conversion,
    outcome_index: snapshot.outcomeIndex,
  };

  const { error } = await supabase
    .from("score_daily")
    .upsert(extendedRow, { onConflict: "business_id,date" });

  if (error && isMissingScoreDailyColumnError(error.message)) {
    const { error: legacyError } = await supabase
      .from("score_daily")
      .upsert(baseRow, { onConflict: "business_id,date" });
    if (legacyError) {
      throw new Error(`Failed to upsert score_daily: ${legacyError.message}`);
    }
    return;
  }

  if (error) throw new Error(`Failed to upsert score_daily: ${error.message}`);
}

type ScoreDailySelectResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

async function selectScoreDailyRows(
  buildQuery: (columns: string) => PromiseLike<ScoreDailySelectResult>
): Promise<Record<string, unknown>[]> {
  const extended = await buildQuery(SCORE_DAILY_EXTENDED_COLUMNS);
  if (!extended.error) return (extended.data ?? []) as Record<string, unknown>[];

  if (isMissingScoreDailyColumnError(extended.error.message)) {
    const legacy = await buildQuery(SCORE_DAILY_BASE_COLUMNS);
    if (legacy.error || !legacy.data) return [];
    return legacy.data as Record<string, unknown>[];
  }

  return [];
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
  const startDate = start.toISOString().slice(0, 10);

  const data = await selectScoreDailyRows((columns) =>
    supabase
      .from("score_daily")
      .select(columns)
      .eq("business_id", businessId)
      .gte("date", startDate)
      .order("date", { ascending: true })
  );

  return data.map((row) => rowToSnapshot(row));
}

export async function listRankSnapshotsForBusinessDate(
  businessId: string,
  date: string,
  options?: RankSnapshotQueryOptions
): Promise<RankSnapshotRow[]> {
  return listRankSnapshotsForBusinessRange(businessId, date, date, options);
}

export async function listRankSnapshotsForBusinessRange(
  businessId: string,
  startDate: string,
  endDate: string,
  options: RankSnapshotQueryOptions = {}
): Promise<RankSnapshotRow[]> {
  const centerPointOnly = options.centerPointOnly ?? true;
  const multiRadius = options.multiRadius ?? HEATMAP_FLAGS.dailyMultiRadius;

  const supabase = createAdminClient();
  let query = supabase
    .from("rank_snapshots")
    .select(
      "business_id, keyword, date, distance_miles, grid_north, grid_east, rank, in_local_pack, local_pack_position, source, ranking_model"
    )
    .eq("business_id", businessId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (centerPointOnly) {
    query = query.eq("grid_north", 0).eq("grid_east", 0);
  }

  if (!multiRadius) {
    query = query.in("distance_miles", [0, 1]);
  } else if (centerPointOnly) {
    query = query.in("distance_miles", [0, ...RADIAL_RING_MILES]);
  }

  const { data, error } = await query.order("date", { ascending: true });

  if (error || !data) return [];

  const rows = data.map((row) => ({
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
    rankingModel: row.ranking_model as RankSnapshotRow["rankingModel"],
  }));

  if (!centerPointOnly) return rows;

  return rows
    .filter((row) => {
      if (row.rankingModel !== "radial_text_v2") {
        return row.distanceMiles === 1;
      }
      return multiRadius
        ? row.distanceMiles === 0 ||
            RADIAL_RING_MILES.includes(row.distanceMiles as (typeof RADIAL_RING_MILES)[number])
        : row.distanceMiles === 0;
    })
    .map((row) =>
      row.rankingModel !== "radial_text_v2" ? { ...row, distanceMiles: 0 } : row
    );
}

export async function listScoreDailyForBusinessAdmin(
  businessId: string,
  days = 90
): Promise<ScoreDailySnapshot[]> {
  const supabase = createAdminClient();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  const startDate = start.toISOString().slice(0, 10);

  const data = await selectScoreDailyRows((columns) =>
    supabase
      .from("score_daily")
      .select(columns)
      .eq("business_id", businessId)
      .gte("date", startDate)
      .order("date", { ascending: true })
  );

  return data.map((row) => rowToSnapshot(row));
}

export async function listAllScoreDailyAdmin(days = 90): Promise<ScoreDailySnapshot[]> {
  const supabase = createAdminClient();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  const startDate = start.toISOString().slice(0, 10);

  const data = await selectScoreDailyRows((columns) =>
    supabase
      .from("score_daily")
      .select(columns)
      .gte("date", startDate)
      .order("date", { ascending: true })
  );

  return data.map((row) => rowToSnapshot(row));
}

export async function listAllRankSnapshotsAdmin(
  days = 90
): Promise<RankSnapshotRow[]> {
  const supabase = createAdminClient();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  const { data, error } = await supabase
    .from("rank_snapshots")
    .select(
      "business_id, keyword, date, distance_miles, grid_north, grid_east, rank, in_local_pack, local_pack_position, source, ranking_model"
    )
    .gte("date", start.toISOString().slice(0, 10))
    .eq("grid_north", 0)
    .eq("grid_east", 0)
    .order("date", { ascending: true });

  if (error || !data) return [];

  return data
    .filter(
      (row) =>
        row.ranking_model === "radial_text_v2" || Number(row.distance_miles) === 1
    )
    .map((row) => ({
      businessId: row.business_id as string,
      keyword: row.keyword as string,
      date: row.date as string,
      distanceMiles:
        row.ranking_model === "radial_text_v2"
          ? (row.distance_miles as number)
          : 0,
      gridNorth: Number(row.grid_north),
      gridEast: Number(row.grid_east),
      rank: row.rank as number | null,
      inLocalPack: row.in_local_pack as boolean,
      localPackPosition: row.local_pack_position as number | null,
      source: row.source as RankSnapshotRow["source"],
      rankingModel: row.ranking_model as RankSnapshotRow["rankingModel"],
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
