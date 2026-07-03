import { listOnboardedBusinesses } from "@/audit/businesses-admin";
import { recomputeAttributionsForBusiness } from "@/audit/attribution";
import { ingestScoreDailyForBusiness } from "@/audit/phase2/score-ingest";
import { refreshGlobalScoreCalibration } from "@/audit/storage-calibration-global";
import { businessRecordToClientConfig, type BusinessRecord } from "@/audit/businesses";
import {
  completeIngestRun,
  failIngestRun,
  startIngestRun,
  upsertPerformanceDaily,
  upsertRankSnapshots,
} from "@/audit/storage-timeseries";
import type { IngestRunResult } from "@/audit/types/timeseries";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { fetchGbpPerformanceDailySeries } from "@/lib/google/gbp-performance";
import {
  resolveBusinessLocation,
  searchKeywordAtOneMile,
} from "@/lib/google/local-rankings";
import { getValidGbpConnectionForRecord } from "@/lib/google/token-store";

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
}

function emptyResult(): IngestRunResult {
  return {
    jobName: "ingest-daily",
    businessesProcessed: 0,
    performanceRowsUpserted: 0,
    rankRowsUpserted: 0,
    scoreRowsUpserted: 0,
    calibrationStepsUpdated: 0,
    errors: [],
  };
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
  for (const keyword of keywords) {
    const { rank, inLocalPack, localPackPosition } = await searchKeywordAtOneMile(
      keyword,
      location,
      matchOptions
    );

    rows.push({
      businessId: row.id,
      keyword,
      date: targetDate,
      distanceMiles: 1,
      gridNorth: 0,
      gridEast: 0,
      rank,
      inLocalPack,
      localPackPosition,
      source: "api" as const,
    });
  }

  const count = await upsertRankSnapshots(rows);
  result.rankRowsUpserted += count;
}

async function ingestBusiness(
  row: BusinessRecord,
  targetDate: string,
  result: IngestRunResult
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

  try {
    await ingestRanksForBusiness(row, targetDate, result);
  } catch (error) {
    result.errors.push({
      businessId: row.id,
      step: "ranks",
      message: error instanceof Error ? error.message : String(error),
    });
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
    if (saved) result.scoreRowsUpserted += 1;
  } catch (error) {
    result.errors.push({
      businessId: row.id,
      step: "score_daily",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  result.businessesProcessed += 1;
}

/**
 * Daily ingest: pull yesterday's GBP performance + 1mi keyword ranks
 * for all onboarded businesses.
 */
export async function ingestDailyMetrics(
  options: IngestDailyOptions = {}
): Promise<IngestRunResult> {
  const targetDate = options.targetDate ?? addDays(new Date(), -1);
  const targetDateStr = formatDateYmd(targetDate);
  const result = emptyResult();

  let runId: string | null = null;
  if (!options.skipRunLog) {
    runId = await startIngestRun("ingest-daily");
  }

  try {
    const businesses = await listOnboardedBusinesses();

    for (const row of businesses) {
      await ingestBusiness(row, targetDateStr, result);
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
