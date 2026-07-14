import { listOnboardedBusinesses } from "@/audit/businesses-admin";
import { recomputeAttributionsForBusiness } from "@/audit/attribution";
import { buildAndPersistLiveAuditForBusiness } from "@/audit/live-audit";
import {
  backfillScoreDailyForBusiness,
  ingestScoreDailyForBusiness,
} from "@/audit/phase2/score-ingest";
import { runRankPulseForBusiness } from "@/audit/market/rank-pulse";
import { reconcilePlanForBusiness } from "@/audit/phase3/reconcile-plan";
import { refreshGlobalScoreCalibration } from "@/audit/storage-calibration-global";
import { refreshGlobalScoreModel } from "@/audit/storage-score-model";
import type { BusinessRecord } from "@/audit/businesses";
import {
  completeIngestRun,
  failIngestRun,
  startIngestRun,
  upsertPerformanceDaily,
} from "@/audit/storage-timeseries";
import type { DailyMetricPoint, IngestRunResult } from "@/audit/types/timeseries";
import { MARKET_DATA_FLAGS, PLAN_RECONCILE_FLAGS } from "@/lib/feature-flags";
import { fetchGbpPerformanceDailySeries } from "@/lib/google/gbp-performance";
import { getValidGbpConnectionForRecord } from "@/lib/google/token-store";

const PERFORMANCE_LOOKBACK_DAYS = 61;
const ACTION_METRICS = ["calls", "direction_requests", "website_clicks"] as const;

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
  /** UTC job execution date used for budget and idempotency periods. */
  runDate?: Date;
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
    placesCallsReserved: 0,
    placesCollectionsSkipped: 0,
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

/**
 * Keep all newly available days in the rolling fetch and materialize missing
 * action values as zero on dates where Google returned another metric.
 */
export function normalizePerformancePoints(
  points: DailyMetricPoint[],
  startDate: string,
  targetDate: string
): DailyMetricPoint[] {
  const byDateMetric = new Map<string, DailyMetricPoint>();

  for (const point of points) {
    if (point.date < startDate || point.date > targetDate) continue;
    byDateMetric.set(`${point.date}:${point.metric}`, point);
  }

  const dates = new Set([...byDateMetric.values()].map((point) => point.date));
  for (const date of dates) {
    for (const metric of ACTION_METRICS) {
      const key = `${date}:${metric}`;
      if (!byDateMetric.has(key)) {
        byDateMetric.set(key, { date, metric, value: 0 });
      }
    }
  }

  return [...byDateMetric.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.metric.localeCompare(b.metric)
  );
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
  const start = addDays(end, -PERFORMANCE_LOOKBACK_DAYS);
  const startDate = formatDateYmd(start);

  const points = await fetchGbpPerformanceDailySeries(connection, start, end);
  const availablePoints = normalizePerformancePoints(points, startDate, targetDate);

  if (availablePoints.length === 0) {
    result.errors.push({
      businessId: row.id,
      step: "performance",
      message: `No performance data returned from ${startDate} through ${targetDate}`,
    });
    return;
  }

  const count = await upsertPerformanceDaily(
    availablePoints.map((p) => ({
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
  collectionDate: string,
  result: IngestRunResult
): Promise<void> {
  const pulse = await runRankPulseForBusiness({
    row,
    observationDate: targetDate,
    collectionDate,
    collectionType: "rank_pulse",
  });
  if (pulse.skipReason === "not_configured") {
    result.errors.push({
      businessId: row.id,
      step: "ranks",
      message: "GOOGLE_MAPS_API_KEY not configured — skipping rank ingest",
    });
  }
  result.rankRowsUpserted += pulse.rowsUpserted;
  result.rankScansLive = (result.rankScansLive ?? 0) + pulse.liveScans;
  result.rankScansDeferred =
    (result.rankScansDeferred ?? 0) + pulse.deferredScans;
  result.rankScansForced =
    (result.rankScansForced ?? 0) + pulse.forcedScans;
  result.placesCallsReserved =
    (result.placesCallsReserved ?? 0) + pulse.callsReserved;
  result.placesCollectionsSkipped =
    (result.placesCollectionsSkipped ?? 0) + (pulse.skipped ? 1 : 0);
}

async function ingestBusiness(
  row: BusinessRecord,
  targetDate: string,
  collectionDate: string,
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
      await ingestRanksForBusiness(row, targetDate, collectionDate, result);
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
  const runDate = options.runDate ?? new Date();
  const collectionDateStr = formatDateYmd(runDate);
  const runRankPulse =
    options.runRankPulse ?? shouldRunScheduledRankPulse(runDate);
  const result = emptyResult();

  let runId: string | null = null;
  if (!options.skipRunLog) {
    runId = await startIngestRun("ingest-daily");
  }

  try {
    const businesses = await listOnboardedBusinesses();

    for (const row of businesses) {
      await ingestBusiness(
        row,
        targetDateStr,
        collectionDateStr,
        result,
        runRankPulse
      );
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
