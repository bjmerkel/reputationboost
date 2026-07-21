import {
  gridCoverageNearDateAdmin,
  loadGridForDateAdmin,
  loadLatestKeywordGridsAdmin,
} from "@/audit/storage-grid-snapshots";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MARKET_REFRESH_FLAGS } from "@/lib/feature-flags";
import { enqueueEventRankPulse } from "@/audit/market/refresh-queue";
import {
  adjustWeaknessScoreForLift,
  buildLiftAdjustment,
  cellCoveragePercent,
  cellLiftKey,
  computeLiftScore,
  formatKeywordScope,
  LIFT_MEASUREMENT_MAX_DAYS,
  LIFT_MEASUREMENT_MIN_DAYS,
  LIFT_RESISTANCE_MIN_SAMPLES,
  LIFT_RESISTANCE_THRESHOLD,
  rankAtCell,
} from "@/lib/review-velocity/lift";
import type { CellWeaknessScore } from "@/lib/review-velocity/cell-weakness";

export interface ReviewVelocityLiftRecord {
  id: string;
  business_id: string;
  attribution_id: string | null;
  sms_message_id: string | null;
  review_id: string | null;
  keyword: string;
  grid_north: number;
  grid_east: number;
  target_zone: string | null;
  sent_at: string;
  review_detected_at: string;
  rank_before: number | null;
  rank_after: number | null;
  in_pack_before: boolean | null;
  in_pack_after: boolean | null;
  coverage_before: number | null;
  coverage_after: number | null;
  lift_score: number | null;
  measured_at: string | null;
  status: string;
}

export interface CellLiftAggregate {
  keyword: string;
  gridNorth: number;
  gridEast: number;
  sampleCount: number;
  avgLiftScore: number;
  resistanceFlag: boolean;
}

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function cellKey(keyword: string, gridNorth: number, gridEast: number): string {
  return cellLiftKey(keyword, gridNorth, gridEast);
}

export async function recordReviewVelocityLiftBaseline(input: {
  businessId: string;
  attributionId: string;
  smsMessageId: string;
  reviewId?: string | null;
  keyword: string;
  gridNorth: number;
  gridEast: number;
  targetZone?: string | null;
  sentAt: string;
  reviewDetectedAt: string;
}): Promise<ReviewVelocityLiftRecord | null> {
  const sentDate = formatDateYmd(new Date(input.sentAt));
  const beforeCoverage = await gridCoverageNearDateAdmin(
    input.businessId,
    input.keyword,
    sentDate,
    "before"
  );
  const gridDate = beforeCoverage?.date ?? sentDate;
  const grid = await loadGridForDateAdmin(input.businessId, input.keyword, gridDate);
  const cell = rankAtCell(grid, input.gridNorth, input.gridEast);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("review_velocity_lift")
    .insert({
      business_id: input.businessId,
      attribution_id: input.attributionId,
      sms_message_id: input.smsMessageId,
      review_id: input.reviewId ?? null,
      keyword: input.keyword,
      grid_north: input.gridNorth,
      grid_east: input.gridEast,
      target_zone: input.targetZone ?? null,
      sent_at: input.sentAt,
      review_detected_at: input.reviewDetectedAt,
      rank_before: cell?.rank ?? null,
      in_pack_before: cell?.inLocalPack ?? null,
      coverage_before: cell ? cellCoveragePercent(cell.inLocalPack) : (beforeCoverage?.coveragePercent ?? null),
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ReviewVelocityLiftRecord;
}

export async function enqueueCampaignKeywordRankPulse(input: {
  businessId: string;
  keyword: string;
  triggerRef?: string | null;
  delayDays?: number;
}): Promise<string> {
  const runAfter = new Date();
  runAfter.setUTCDate(
    runAfter.getUTCDate() + (input.delayDays ?? MARKET_REFRESH_FLAGS.eventDelayDays)
  );

  return enqueueEventRankPulse({
    businessId: input.businessId,
    triggerSource: "gbp_event",
    triggerRef: input.triggerRef ?? null,
    runAfter: runAfter.toISOString(),
    keywordScope: formatKeywordScope(input.keyword),
    callsEstimated: 1,
  });
}

export async function finalizeDueReviewVelocityLifts(
  businessId?: string
): Promise<number> {
  const supabase = createAdminClient();
  const minMeasuredAt = addDays(new Date(), -LIFT_MEASUREMENT_MAX_DAYS);
  const minReadyAt = addDays(new Date(), -LIFT_MEASUREMENT_MIN_DAYS);

  let query = supabase
    .from("review_velocity_lift")
    .select("*")
    .eq("status", "pending")
    .lte("review_detected_at", minReadyAt.toISOString())
    .gte("review_detected_at", minMeasuredAt.toISOString())
    .limit(100);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data?.length) return 0;

  let finalized = 0;

  for (const row of data) {
    const reviewDate = formatDateYmd(new Date(row.review_detected_at as string));
    const afterCoverage = await gridCoverageNearDateAdmin(
      row.business_id as string,
      row.keyword as string,
      reviewDate,
      "after"
    );
    const gridDate = afterCoverage?.date ?? formatDateYmd(new Date());
    const grid = await loadGridForDateAdmin(
      row.business_id as string,
      row.keyword as string,
      gridDate
    );
    const cell = rankAtCell(
      grid,
      Number(row.grid_north),
      Number(row.grid_east)
    );

    if (!cell && !afterCoverage) {
      await supabase
        .from("review_velocity_lift")
        .update({ status: "insufficient_data" })
        .eq("id", row.id as string);
      continue;
    }

    const coverageAfter = cell
      ? cellCoveragePercent(cell.inLocalPack)
      : (afterCoverage?.coveragePercent ?? null);
    const liftScore = computeLiftScore({
      rankBefore: (row.rank_before as number | null) ?? null,
      rankAfter: cell?.rank ?? null,
      coverageBefore: row.coverage_before as number | null,
      coverageAfter,
    });

    await supabase
      .from("review_velocity_lift")
      .update({
        rank_after: cell?.rank ?? null,
        in_pack_after: cell?.inLocalPack ?? null,
        coverage_after: coverageAfter,
        lift_score: liftScore,
        measured_at: new Date().toISOString(),
        status: liftScore == null ? "insufficient_data" : "measured",
      })
      .eq("id", row.id as string);

    finalized += 1;
  }

  if (finalized > 0) {
    const businessIds = businessId
      ? [businessId]
      : [...new Set((data ?? []).map((row) => row.business_id as string))];
    for (const id of businessIds) {
      await applyLiftAdjustmentsForBusinessAdmin(id);
    }
  }

  return finalized;
}

function buildCellLiftAggregates(
  rows: Array<{
    keyword: string;
    grid_north: number;
    grid_east: number;
    lift_score: number;
  }>
): Map<string, CellLiftAggregate> {
  const buckets = new Map<string, number[]>();

  for (const row of rows) {
    const key = cellKey(row.keyword, Number(row.grid_north), Number(row.grid_east));
    const scores = buckets.get(key) ?? [];
    scores.push(Number(row.lift_score));
    buckets.set(key, scores);
  }

  const aggregates = new Map<string, CellLiftAggregate>();

  for (const [key, scores] of buckets) {
    const [keyword, gridNorthRaw, gridEastRaw] = key.split("|");
    const avgLiftScore =
      Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) / 100;
    aggregates.set(key, {
      keyword,
      gridNorth: Number(gridNorthRaw),
      gridEast: Number(gridEastRaw),
      sampleCount: scores.length,
      avgLiftScore,
      resistanceFlag:
        scores.length >= LIFT_RESISTANCE_MIN_SAMPLES &&
        avgLiftScore < LIFT_RESISTANCE_THRESHOLD,
    });
  }

  return aggregates;
}

async function fetchMeasuredLiftRows(
  supabase: SupabaseClient,
  businessId: string
): Promise<
  Array<{
    keyword: string;
    grid_north: number;
    grid_east: number;
    lift_score: number;
  }>
> {
  const since = addDays(new Date(), -90);

  const { data, error } = await supabase
    .from("review_velocity_lift")
    .select("keyword, grid_north, grid_east, lift_score")
    .eq("business_id", businessId)
    .eq("status", "measured")
    .gte("measured_at", since.toISOString())
    .not("lift_score", "is", null);

  if (error) throw new Error(error.message);

  return (data ?? []) as Array<{
    keyword: string;
    grid_north: number;
    grid_east: number;
    lift_score: number;
  }>;
}

export async function loadCellLiftAggregatesAdmin(
  businessId: string
): Promise<Map<string, CellLiftAggregate>> {
  const supabase = createAdminClient();
  const rows = await fetchMeasuredLiftRows(supabase, businessId);
  return buildCellLiftAggregates(rows);
}

export async function loadCellLiftAggregatesForUser(
  businessId: string
): Promise<Map<string, CellLiftAggregate>> {
  const supabase = await createClient();
  const rows = await fetchMeasuredLiftRows(supabase, businessId);
  return buildCellLiftAggregates(rows);
}

export async function applyLiftAdjustmentsForBusinessAdmin(
  businessId: string
): Promise<number> {
  const aggregates = await loadCellLiftAggregatesAdmin(businessId);
  if (aggregates.size === 0) return 0;

  const keywords = [...new Set([...aggregates.values()].map((row) => row.keyword))];
  const date = formatDateYmd(new Date());
  const keywordGrids = await loadLatestKeywordGridsAdmin(businessId, keywords, date);
  if (keywordGrids.size === 0) return 0;

  const supabase = createAdminClient();
  const { data: weaknessRows, error } = await supabase
    .from("cell_weakness_scores")
    .select("*")
    .eq("business_id", businessId)
    .order("computed_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  if (!weaknessRows?.length) return 0;

  const latestByCell = new Map<string, { id: string; score: CellWeaknessScore }>();

  for (const row of weaknessRows) {
    const key = cellKey(
      row.keyword as string,
      Number(row.grid_north),
      Number(row.grid_east)
    );
    if (latestByCell.has(key)) continue;
    latestByCell.set(key, {
      id: row.id as string,
      score: {
        keyword: row.keyword as string,
        gridNorth: Number(row.grid_north),
        gridEast: Number(row.grid_east),
        zoneDirection: row.zone_direction as CellWeaknessScore["zoneDirection"],
        rank: row.rank as number | null,
        inLocalPack: row.in_local_pack as boolean,
        reviewGap: Number(row.review_gap ?? 0),
        weaknessScore: Number(row.weakness_score),
      },
    });
  }

  let updated = 0;
  const computedAt = new Date().toISOString();

  for (const { id, score } of latestByCell.values()) {
    const aggregate =
      aggregates.get(cellKey(score.keyword, score.gridNorth, score.gridEast)) ?? null;
    const adjustedScore = adjustWeaknessScoreForLift(score.weaknessScore, aggregate);
    const liftAdjustment = buildLiftAdjustment(score.weaknessScore, adjustedScore);

    const { error: updateError } = await supabase
      .from("cell_weakness_scores")
      .update({
        weakness_score: adjustedScore,
        lift_adjustment: liftAdjustment,
        computed_at: computedAt,
      })
      .eq("id", id);

    if (!updateError) updated += 1;
  }

  return updated;
}

export async function handleAttributedReviewLift(input: {
  businessId: string;
  attributionId: string;
  smsMessageId: string;
  reviewId?: string | null;
  keyword: string;
  gridNorth: number;
  gridEast: number;
  targetZone?: string | null;
  sentAt: string;
  reviewDetectedAt: string;
}): Promise<void> {
  await recordReviewVelocityLiftBaseline(input);
  await enqueueCampaignKeywordRankPulse({
    businessId: input.businessId,
    keyword: input.keyword,
    triggerRef: `lift:${input.attributionId}`,
  });
}
