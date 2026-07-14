import { listOnboardedBusinesses } from "@/audit/businesses-admin";
import { recomputeAttributionsForBusiness } from "@/audit/attribution";
import { buildAndPersistLiveAuditForBusiness } from "@/audit/live-audit";
import {
  backfillScoreDailyForBusiness,
  ingestScoreDailyForBusiness,
} from "@/audit/phase2/score-ingest";
import { planKeywordRankScans } from "@/audit/phase2/rank-scan-plan";
import { reconcilePlanForBusiness } from "@/audit/phase3/reconcile-plan";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import { refreshGlobalScoreCalibration } from "@/audit/storage-calibration-global";
import { refreshGlobalScoreModel } from "@/audit/storage-score-model";
import { businessRecordToClientConfig, type BusinessRecord } from "@/audit/businesses";
import {
  completeIngestRun,
  failIngestRun,
  startIngestRun,
  upsertPerformanceDaily,
  upsertRankSnapshots,
} from "@/audit/storage-timeseries";
import type { IngestRunResult } from "@/audit/types/timeseries";
import {
  GBP_RANK_SCAN_FLAGS,
  MARKET_DATA_FLAGS,
  PLAN_RECONCILE_FLAGS,
} from "@/lib/feature-flags";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { fetchGbpPerformanceDailySeries } from "@/lib/google/gbp-performance";
import {
  resolveBusinessLocation,
  searchKeywordAtOneMile,
} from "@/lib/google/local-rankings";
import { getValidGbpConnectionForRecord } from "@/lib/google/token-store";

const KEYWORD_SEARCH_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export interface IngestDailyOptions {
  /** Date to ingest (defaults to yesterday UTC). */
  targetDate?: Date;
  /** When true, skip writing ingest_runs row (for backfill batches). */
  skipRunLog?: boolean;
  /** Override the twice-monthly Places rank pulse (primarily for tests/backfills). */
  runRankPulse?: boolean;
}

export function shouldRunScheduledRankPulse(date: Date): boolean {
  return MARKET_DATA_FLAGS.rankPulseDaysUtc.includes(date.getUTCDate());
}

function emptyResult(): IngestRunResult {
  return {
    jobName: "ingest-daily",
    businessesProcessed: 0,
    performanceRowsUpserted: 0,
    rankRowsUpserted: 0,
    scoreRowsUpserted: 0,
    calibrationStepsUpdated: 0,
    planTasksCreated: 0,
    planTasksAutoCompleted: 0,
    planReconcileBusinesses: 0,
    rankScansLive: 0,
    rankScansDeferred: 0,
    rankScansForced: 0,
    errors: [],
  };
}

/** Apply reconcile counts onto the ingest run result (exported for tests). */
export function recordPlanReconcileMetrics(
  result: IngestRunResult,
  createdCount: number,
  completedCount: number
): void {
  result.planTasksCreated = (result.planTasksCreated ?? 0) + createdCount;
  result.planTasksAutoCompleted = (result.planTasksAutoCompleted ?? 0) + completedCount;
  result.planReconcileBusinesses = (result.planReconcileBusinesses ?? 0) + 1;
}

async function ingestPerformanceForBusiness(
  row: BusinessRecord,
  targetDate: string,
  result: IngestRunResult
): Promise<void> {
  const connection = await getValidGbpConnectionForRecord(row);
  if (!connection) {
    result.errors.push({
      businessId: row.id,
      step: "performance",
      message: "No valid GBP connection",
    });
    return;
  }

  const end = addDays(new Date(`${targetDate}T12:00:00.000Z`), 1);
  const start = addDays(end, -4);

  const points = await fetchGbpPerformanceDailySeries(connection, start, end);
  const forDate = points.filter((p) => p.date === targetDate);

  if (forDate.length === 0) {
    result.errors.push({
      businessId: row.id,
      step: "performance",
      message: `No performance data returned for ${targetDate}`,
    });
    return;
  }

  const count = await upsertPerformanceDaily(
    forDate.map((p) => ({
      businessId: row.id,
      date: p.date,
      metric: p.metric,
      value: p.value,
      source: "api",
    }))
  );
  result.performanceRowsUpserted += count;
}

async function ingestRanksForBusiness(
  row: BusinessRecord,
  targetDate: string,
  result: IngestRunResult
): Promise<void> {
  if (!isGoogleMapsConfigured()) {
    result.errors.push({
      businessId: row.id,
      step: "ranks",
      message: "GOOGLE_MAPS_API_KEY not configured — skipping rank ingest",
    });
    return;
  }

  const client = businessRecordToClientConfig(row);
  const keywords = client.keywords.filter(Boolean);
  if (keywords.length === 0) return;

  const latestAudit = await loadLatestAuditForBusinessAdmin(
    row.user_id,
    row.id,
    row.slug,
    row.name
  ).catch(() => null);
  const scanPlan = planKeywordRankScans({
    keywords,
    audit: latestAudit,
    targetDate,
    context: "daily",
    enabled: GBP_RANK_SCAN_FLAGS.enabled,
    minLiveScans: GBP_RANK_SCAN_FLAGS.minDailyLiveScans,
  });

  const location = await resolveBusinessLocation(client);
  const matchOptions = {
    businessName: client.name,
    placeId: client.gbpPlaceId,
    businessAddress: [
      client.location.address,
      client.location.city,
      client.location.state,
      client.location.zip,
    ]
      .filter(Boolean)
      .join(", "),
  };

  const rows = [];
  for (const keyword of scanPlan.liveScan) {
    const { rank, inLocalPack, localPackPosition } = await searchKeywordAtOneMile(
      keyword,
      location,
      matchOptions
    );

    rows.push({
      businessId: row.id,
      keyword,
      date: targetDate,
      distanceMiles: 0,
      gridNorth: 0,
      gridEast: 0,
      rank,
      inLocalPack,
      localPackPosition,
      source: "api" as const,
      rankingModel: "radial_text_v2" as const,
    });

    await sleep(KEYWORD_SEARCH_DELAY_MS);
  }

  const priorByKeyword = new Map(
    (latestAudit?.rankings.keywords ?? []).map((item) => [
      item.keyword.trim().toLowerCase(),
      item,
    ])
  );
  for (const deferred of scanPlan.deferred) {
    const prior = priorByKeyword.get(deferred.keyword);
    if (!prior) continue;
    const priorPosition =
      typeof prior.localPackPosition === "number"
        ? prior.localPackPosition
        : null;
    rows.push({
      businessId: row.id,
      keyword: deferred.keyword,
      date: targetDate,
      distanceMiles: 0,
      gridNorth: 0,
      gridEast: 0,
      rank: prior.centerRank ?? priorPosition,
      inLocalPack: prior.inLocalPack,
      localPackPosition: priorPosition,
      source: "deferred" as const,
      rankingModel: "radial_text_v2" as const,
    });
  }

  const count = await upsertRankSnapshots(rows);
  result.rankRowsUpserted += count;
  result.rankScansLive = (result.rankScansLive ?? 0) + scanPlan.liveScan.length;
  result.rankScansDeferred =
    (result.rankScansDeferred ?? 0) + scanPlan.deferred.length;
  result.rankScansForced =
    (result.rankScansForced ?? 0) + scanPlan.forcedRescan.length;
}

async function ingestBusiness(
  row: BusinessRecord,
  targetDate: string,
  result: IngestRunResult,
  runRankPulse: boolean
): Promise<void> {
  try {
    await ingestPerformanceForBusiness(row, targetDate, result);
  } catch (error) {
    result.errors.push({
      businessId: row.id,
      step: "performance",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (runRankPulse) {
    try {
      await ingestRanksForBusiness(row, targetDate, result);
    } catch (error) {
      result.errors.push({
        businessId: row.id,
        step: "ranks",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    await recomputeAttributionsForBusiness(row.id);
  } catch (error) {
    result.errors.push({
      businessId: row.id,
      step: "attribution",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const saved = await ingestScoreDailyForBusiness(row.id, targetDate);
    if (saved) {
      result.scoreRowsUpserted += 1;
      const backfilled = await backfillScoreDailyForBusiness(row.id);
      result.scoreRowsUpserted += backfilled;
    }
  } catch (error) {
    result.errors.push({
      businessId: row.id,
      step: "score_daily",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let liveAuditPersisted = false;
  try {
    const persisted = await buildAndPersistLiveAuditForBusiness(row, targetDate);
    liveAuditPersisted = Boolean(persisted);
    if (!persisted) {
      result.errors.push({
        businessId: row.id,
        step: "live_audit",
        message: "No audit snapshot to hydrate",
      });
    }
  } catch (error) {
    result.errors.push({
      businessId: row.id,
      step: "live_audit",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // Reconcile plan after live audit so tasks see refreshed GBP/rankings.
  // Does not call Places — uses data already written by this ingest pass.
  if (liveAuditPersisted && PLAN_RECONCILE_FLAGS.enabled) {
    try {
      const reconcile = await reconcilePlanForBusiness(row);
      if (reconcile) {
        recordPlanReconcileMetrics(
          result,
          reconcile.createdTasks.length,
          reconcile.completedTasks.length
        );
      }
    } catch (error) {
      result.errors.push({
        businessId: row.id,
        step: "plan_reconcile",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  result.businessesProcessed += 1;
}

/**
 * Daily ingest: pull yesterday's GBP performance + business-pin keyword estimates
 * for all onboarded businesses,
 * then reconcile the Plan tab (append missing tasks / auto-complete stale work).
 */
export async function ingestDailyMetrics(
  options: IngestDailyOptions = {}
): Promise<IngestRunResult> {
  const targetDate = options.targetDate ?? addDays(new Date(), -1);
  const targetDateStr = formatDateYmd(targetDate);
  const runRankPulse =
    options.runRankPulse ?? shouldRunScheduledRankPulse(new Date());
  const result = emptyResult();

  let runId: string | null = null;
  if (!options.skipRunLog) {
    runId = await startIngestRun("ingest-daily");
  }

  try {
    const businesses = await listOnboardedBusinesses();

    for (const row of businesses) {
      await ingestBusiness(row, targetDateStr, result, runRankPulse);
    }

    try {
      result.calibrationStepsUpdated = await refreshGlobalScoreCalibration();
    } catch (error) {
      result.errors.push({
        businessId: "",
        step: "calibration",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await refreshGlobalScoreModel();
    } catch (error) {
      result.errors.push({
        businessId: "",
        step: "score_model",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (runId) {
      await completeIngestRun(runId, result);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) {
      await failIngestRun(runId, result, message);
    }
    throw error;
  }
}
