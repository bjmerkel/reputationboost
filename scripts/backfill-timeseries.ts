#!/usr/bin/env npx tsx
/**
 * Backfill performance_daily and rank_snapshots from historical audit_runs.payload.
 *
 * Usage:
 *   npx tsx scripts/backfill-timeseries.ts
 *   npx tsx scripts/backfill-timeseries.ts --business-id=<uuid>
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import {
  upsertPerformanceDaily,
  upsertRankSnapshots,
} from "../src/audit/storage-timeseries";
import { backfillScoreDailyForBusiness } from "../src/audit/phase2/score-ingest";
import type { FullAuditPayload } from "../src/audit/types";
import type { PerformanceDailyMetric } from "../src/audit/types/timeseries";

function rankAt1Mi(keyword: {
  geoRanks: { distanceMiles: number; rank: number | null }[];
}): number | null {
  return keyword.geoRanks.find((g) => g.distanceMiles === 1)?.rank ?? null;
}

async function backfillFromAudits(businessIdFilter?: string) {
  const supabase = createAdminClient();

  let query = supabase
    .from("audit_runs")
    .select("business_id, audit_id, completed_at, payload")
    .order("completed_at", { ascending: true });

  if (businessIdFilter) {
    query = query.eq("business_id", businessIdFilter);
  }

  const { data: audits, error } = await query;
  if (error) throw new Error(error.message);

  let performanceRows = 0;
  let rankRows = 0;

  for (const row of audits ?? []) {
    const payload = row.payload as FullAuditPayload;
    const date = row.audit_id || row.completed_at?.slice(0, 10);
    if (!date) continue;

    const perf = payload.gbp?.performance;
    if (perf) {
      const metrics: Array<{ metric: string; value: number }> = [
        { metric: "calls", value: perf.calls },
        { metric: "direction_requests", value: perf.directionRequests },
        { metric: "website_clicks", value: perf.websiteClicks },
        { metric: "profile_views", value: perf.profileViews },
        { metric: "impressions_maps", value: perf.impressionsMaps },
        { metric: "impressions_search", value: perf.impressionsSearch },
        { metric: "conversations", value: perf.conversations },
        { metric: "bookings", value: perf.bookings },
      ].filter((m) => m.value > 0);

      if (metrics.length > 0) {
        performanceRows += await upsertPerformanceDaily(
          metrics.map((m) => ({
            businessId: row.business_id,
            date,
            metric: m.metric as PerformanceDailyMetric,
            value: m.value,
            source: "audit_backfill",
          }))
        );
      }
    }

    const keywords = payload.rankings?.keywords ?? [];
    if (keywords.length > 0) {
      const snapshots = keywords.flatMap((kw) => {
        const geoRanks =
          kw.geoRanks.length > 0
            ? kw.geoRanks
            : [{ distanceMiles: 1, rank: rankAt1Mi(kw), inLocalPack: false }];

        return geoRanks.map((g) => {
          const rank = g.rank;
          const inLocalPack = rank !== null && rank <= 3;
          return {
            businessId: row.business_id,
            keyword: kw.keyword,
            date,
            distanceMiles: g.distanceMiles,
            gridNorth: 0,
            gridEast: 0,
            rank,
            inLocalPack,
            localPackPosition: inLocalPack ? rank : null,
            source: "audit_backfill" as const,
          };
        });
      });

      rankRows += await upsertRankSnapshots(snapshots);
    }
  }

  console.log(
    `Backfill complete: ${audits?.length ?? 0} audits processed, ` +
      `${performanceRows} performance rows, ${rankRows} rank rows upserted.`
  );

  if (businessIdFilter) {
    const scoreRows = await backfillScoreDailyForBusiness(businessIdFilter);
    console.log(`Score backfill: ${scoreRows} score_daily rows upserted.`);
  } else {
    const businessIds = [...new Set((audits ?? []).map((row) => row.business_id as string))];
    let scoreRows = 0;
    for (const id of businessIds) {
      scoreRows += await backfillScoreDailyForBusiness(id);
    }
    console.log(`Score backfill: ${scoreRows} score_daily rows upserted.`);
  }
}

const businessIdArg = process.argv.find((a) => a.startsWith("--business-id="));
const businessId = businessIdArg?.split("=")[1];

backfillFromAudits(businessId).catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
