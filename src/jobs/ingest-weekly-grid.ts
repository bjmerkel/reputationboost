import { listOnboardedBusinesses } from "@/audit/businesses-admin";
import { businessRecordToClientConfig, type BusinessRecord } from "@/audit/businesses";
import {
  completeIngestRun,
  failIngestRun,
  startIngestRun,
} from "@/audit/storage-timeseries";
import { persistKeywordGridFromCollection } from "@/audit/storage-grid-snapshots";
import type { IngestRunResult } from "@/audit/types/timeseries";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { collectKeywordGeoGrid } from "@/lib/google/geo-grid";
import {
  resolveBusinessLocation,
  type BusinessMatchOptions,
} from "@/lib/google/local-rankings";

const SEARCH_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function emptyResult(): IngestRunResult {
  return {
    jobName: "ingest-weekly-grid",
    businessesProcessed: 0,
    performanceRowsUpserted: 0,
    rankRowsUpserted: 0,
    scoreRowsUpserted: 0,
    calibrationStepsUpdated: 0,
    errors: [],
  };
}

async function ingestGridForBusiness(
  row: BusinessRecord,
  targetDate: string,
  result: IngestRunResult
): Promise<void> {
  if (!isGoogleMapsConfigured()) {
    result.errors.push({
      businessId: row.id,
      step: "weekly_grid",
      message: "GOOGLE_MAPS_API_KEY not configured",
    });
    return;
  }

  const client = businessRecordToClientConfig(row);
  const keywords = client.keywords.filter(Boolean).slice(0, 5);
  if (keywords.length === 0) return;

  const location = await resolveBusinessLocation(client);
  const matchOptions: BusinessMatchOptions = {
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

  for (const keyword of keywords) {
    try {
      const geoGrid = await collectKeywordGeoGrid(keyword, location, matchOptions, {
        profile: "compact",
        includeLocalPack: true,
      });
      await persistKeywordGridFromCollection(row.id, keyword, geoGrid, "weekly");
      result.rankRowsUpserted += geoGrid.length;
      await sleep(SEARCH_DELAY_MS);
    } catch (error) {
      result.errors.push({
        businessId: row.id,
        step: `weekly_grid:${keyword}`,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  result.businessesProcessed += 1;
}

export interface IngestWeeklyGridOptions {
  targetDate?: Date;
  skipRunLog?: boolean;
}

/** Weekly full geo-grid snapshot for all onboarded businesses. */
export async function ingestWeeklyGrid(
  options: IngestWeeklyGridOptions = {}
): Promise<IngestRunResult> {
  const targetDate = options.targetDate ?? new Date();
  const targetDateStr = formatDateYmd(targetDate);
  const result = emptyResult();

  let runId: string | null = null;
  if (!options.skipRunLog) {
    runId = await startIngestRun("ingest-weekly-grid");
  }

  try {
    const businesses = await listOnboardedBusinesses();
    for (const row of businesses) {
      await ingestGridForBusiness(row, targetDateStr, result);
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
