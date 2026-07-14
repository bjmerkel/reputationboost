import { businessRecordToClientConfig, type BusinessRecord } from "@/audit/businesses";
import { planKeywordRankScans } from "@/audit/phase2/rank-scan-plan";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import { upsertRankSnapshots } from "@/audit/storage-timeseries";
import { GBP_RANK_SCAN_FLAGS } from "@/lib/feature-flags";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import {
  resolveBusinessLocation,
  searchKeywordAtOneMile,
} from "@/lib/google/local-rankings";
import {
  claimMarketCollection,
  completeMarketCollection,
  failMarketCollection,
  recordPlacesCollectionSkipped,
  reservePlacesApiCalls,
  type MarketCollectionClaim,
  type MarketCollectionType,
} from "@/lib/google/places-cost-governance";

const KEYWORD_SEARCH_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RankPulseResult {
  rowsUpserted: number;
  liveScans: number;
  deferredScans: number;
  forcedScans: number;
  callsReserved: number;
  skipped: boolean;
  skipReason?: "not_configured" | "no_keywords" | "already_claimed" | "budget";
}

export async function runRankPulseForBusiness(options: {
  row: BusinessRecord;
  observationDate: string;
  collectionDate: string;
  collectionType: Exclude<MarketCollectionType, "monthly_market">;
}): Promise<RankPulseResult> {
  if (!isGoogleMapsConfigured()) {
    return {
      rowsUpserted: 0,
      liveScans: 0,
      deferredScans: 0,
      forcedScans: 0,
      callsReserved: 0,
      skipped: true,
      skipReason: "not_configured",
    };
  }

  const client = businessRecordToClientConfig(options.row);
  const keywords = client.keywords.filter(Boolean);
  if (keywords.length === 0) {
    return {
      rowsUpserted: 0,
      liveScans: 0,
      deferredScans: 0,
      forcedScans: 0,
      callsReserved: 0,
      skipped: true,
      skipReason: "no_keywords",
    };
  }

  const latestAudit = await loadLatestAuditForBusinessAdmin(
    options.row.user_id,
    options.row.id,
    options.row.slug,
    options.row.name
  ).catch(() => null);
  const scanPlan = planKeywordRankScans({
    keywords,
    audit: latestAudit,
    targetDate: options.observationDate,
    context: "daily",
    enabled: GBP_RANK_SCAN_FLAGS.enabled,
    minLiveScans: GBP_RANK_SCAN_FLAGS.minDailyLiveScans,
  });
  const claim: MarketCollectionClaim = {
    businessId: options.row.id,
    collectionType: options.collectionType,
    keyword: "__all__",
    periodStart: options.collectionDate,
  };
  if (!(await claimMarketCollection(claim))) {
    await recordPlacesCollectionSkipped(
      options.row.id,
      options.collectionDate
    );
    return {
      rowsUpserted: 0,
      liveScans: 0,
      deferredScans: 0,
      forcedScans: 0,
      callsReserved: 0,
      skipped: true,
      skipReason: "already_claimed",
    };
  }

  const callsReserved = scanPlan.liveScan.length;
  if (
    !(await reservePlacesApiCalls(
      options.row.id,
      options.collectionDate,
      callsReserved
    ))
  ) {
    await recordPlacesCollectionSkipped(
      options.row.id,
      options.collectionDate
    );
    await completeMarketCollection(claim, 0);
    return {
      rowsUpserted: 0,
      liveScans: 0,
      deferredScans: 0,
      forcedScans: 0,
      callsReserved: 0,
      skipped: true,
      skipReason: "budget",
    };
  }

  try {
    const location = await resolveBusinessLocation(client);
    const matchOptions = {
      businessName: client.name,
      placeId: client.gbpPlaceId,
      businessAddress:
        client.gbpAddress ||
        [
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
      const { rank, inLocalPack, localPackPosition } =
        await searchKeywordAtOneMile(keyword, location, matchOptions);
      rows.push({
        businessId: options.row.id,
        keyword,
        date: options.observationDate,
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
        businessId: options.row.id,
        keyword: deferred.keyword,
        date: options.observationDate,
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

    const rowsUpserted = await upsertRankSnapshots(rows);
    await completeMarketCollection(claim, callsReserved);
    return {
      rowsUpserted,
      liveScans: scanPlan.liveScan.length,
      deferredScans: scanPlan.deferred.length,
      forcedScans: scanPlan.forcedRescan.length,
      callsReserved,
      skipped: false,
    };
  } catch (error) {
    await failMarketCollection(claim, callsReserved, error).catch(
      () => undefined
    );
    throw error;
  }
}
