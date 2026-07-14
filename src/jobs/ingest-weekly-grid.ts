import { listOnboardedBusinesses } from "@/audit/businesses-admin";
import { businessRecordToClientConfig, type BusinessRecord } from "@/audit/businesses";
import {
  buildAndPersistLiveAuditForBusiness,
  persistMarketCompetitorsToLatestAudit,
} from "@/audit/live-audit";
import { prioritizeKeywordsForGrid } from "@/audit/phase2/keyword-portfolio";
import { planKeywordRankScans } from "@/audit/phase2/rank-scan-plan";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import {
  completeIngestRun,
  failIngestRun,
  startIngestRun,
} from "@/audit/storage-timeseries";
import { persistKeywordGridFromCollection } from "@/audit/storage-grid-snapshots";
import type { CompetitorSnapshot } from "@/audit/types";
import type { IngestRunResult } from "@/audit/types/timeseries";
import { ingestScoreDailyForBusiness, backfillScoreDailyForBusiness } from "@/audit/phase2/score-ingest";
import {
  GBP_RANK_SCAN_FLAGS,
  gridProfileForCollection,
  HEATMAP_FLAGS,
} from "@/lib/feature-flags";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { collectKeywordGeoGrid } from "@/lib/google/geo-grid";
import {
  collectCompetitorSnapshot,
  resolveBusinessLocation,
  type BusinessMatchOptions,
} from "@/lib/google/local-rankings";
import {
  claimMarketCollection,
  completeMarketCollection,
  failMarketCollection,
  monthStartYmd,
  MONTHLY_KEYWORD_CALL_RESERVATION,
  recordPlacesCollectionSkipped,
  reservePlacesApiCalls,
  type MarketCollectionClaim,
} from "@/lib/google/places-cost-governance";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";

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
  const allKeywords = client.keywords.filter(Boolean);
  if (allKeywords.length === 0) return;

  const gridKeywordLimit = HEATMAP_FLAGS.weeklyKeywordLimit;
  let keywords = allKeywords.slice(0, gridKeywordLimit);
  try {
    const audit = await loadLatestAuditForBusinessAdmin(
      row.user_id,
      row.id,
      row.slug,
      row.name
    );
    if (audit) {
      const scanPlan = planKeywordRankScans({
        keywords: allKeywords,
        audit,
        targetDate,
        context: "weekly_grid",
        enabled: GBP_RANK_SCAN_FLAGS.enabled,
        minLiveScans: GBP_RANK_SCAN_FLAGS.minWeeklyLiveScans,
      });
      const forced = scanPlan.forcedRescan.slice(0, gridKeywordLimit);
      const forcedSet = new Set(forced);
      const prioritized = prioritizeKeywordsForGrid(
        audit,
        scanPlan.liveScan.filter((keyword) => !forcedSet.has(keyword)),
        Math.max(0, gridKeywordLimit - forced.length)
      );
      keywords = [...prioritized, ...forced];
      const baselineKeywordCount = Math.min(
        gridKeywordLimit,
        allKeywords.length
      );
      result.rankScansDeferred =
        (result.rankScansDeferred ?? 0) +
        Math.max(0, baselineKeywordCount - keywords.length) * 25;
      result.rankScansForced =
        (result.rankScansForced ?? 0) +
        forced.length * 25;
    }
  } catch {
    keywords = allKeywords.slice(0, gridKeywordLimit);
  }

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
  const competitorSnapshots: CompetitorSnapshot[] = [];

  for (const keyword of keywords) {
    const claim: MarketCollectionClaim = {
      businessId: row.id,
      collectionType: "monthly_market",
      keyword,
      periodStart: monthStartYmd(targetDate),
    };
    try {
      if (!(await claimMarketCollection(claim))) {
        result.placesCollectionsSkipped =
          (result.placesCollectionsSkipped ?? 0) + 1;
        await recordPlacesCollectionSkipped(row.id, targetDate);
        continue;
      }
      if (
        !(await reservePlacesApiCalls(
          row.id,
          targetDate,
          MONTHLY_KEYWORD_CALL_RESERVATION
        ))
      ) {
        result.placesCollectionsSkipped =
          (result.placesCollectionsSkipped ?? 0) + 1;
        await recordPlacesCollectionSkipped(row.id, targetDate);
        await completeMarketCollection(claim, 0);
        continue;
      }
      result.placesCallsReserved =
        (result.placesCallsReserved ?? 0) +
        MONTHLY_KEYWORD_CALL_RESERVATION;

      const geoGrid = await collectKeywordGeoGrid(
        keyword,
        location,
        matchOptions,
        {
          profile: gridProfileForCollection("weekly", client.heatmapProfile),
          includeLocalPack: true,
        }
      );
      const competitorSnapshot = await collectCompetitorSnapshot(
        keyword,
        location,
        matchOptions,
        `${client.location.city}, ${client.location.state}`
      );
      await persistKeywordGridFromCollection(
        row.id,
        keyword,
        geoGrid,
        "weekly"
      );
      competitorSnapshots.push(competitorSnapshot);
      // 25 raw samples plus one aggregate row for each 1/3/5-mile ring.
      result.rankRowsUpserted += geoGrid.length + RADIAL_RING_MILES.length;
      result.rankScansLive = (result.rankScansLive ?? 0) + geoGrid.length;
      await completeMarketCollection(
        claim,
        MONTHLY_KEYWORD_CALL_RESERVATION
      );
      await sleep(SEARCH_DELAY_MS);
    } catch (error) {
      await failMarketCollection(
        claim,
        MONTHLY_KEYWORD_CALL_RESERVATION,
        error
      ).catch(() => undefined);
      result.errors.push({
        businessId: row.id,
        step: `monthly_market:${keyword}`,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    await persistMarketCompetitorsToLatestAudit(
      row.id,
      competitorSnapshots
    );
    await buildAndPersistLiveAuditForBusiness(row, targetDate);
  } catch (error) {
    result.errors.push({
      businessId: row.id,
      step: "monthly_market_publish",
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

  result.businessesProcessed += 1;
}

export interface IngestWeeklyGridOptions {
  targetDate?: Date;
  skipRunLog?: boolean;
}

/** Monthly full geo-grid market snapshot for all onboarded businesses. */
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
