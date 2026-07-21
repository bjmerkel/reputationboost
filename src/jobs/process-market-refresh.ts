import { listOnboardedBusinesses } from "@/audit/businesses-admin";
import { buildAndPersistLiveAuditForBusiness } from "@/audit/live-audit";
import {
  listDueMarketRefreshes,
  markMarketRefreshQueueItem,
} from "@/audit/market/refresh-queue";
import { runRankPulseForBusiness } from "@/audit/market/rank-pulse";
import { finalizeDueReviewVelocityLifts } from "@/lib/review-velocity/lift-storage";

export interface ProcessMarketRefreshResult {
  processed: number;
  completed: number;
  skipped: number;
  failed: number;
  liftsFinalized: number;
}

export async function processDueMarketRefreshes(
  now = new Date()
): Promise<ProcessMarketRefreshResult> {
  const result = { processed: 0, completed: 0, skipped: 0, failed: 0, liftsFinalized: 0 };
  const [due, businesses] = await Promise.all([
    listDueMarketRefreshes(now),
    listOnboardedBusinesses(),
  ]);
  const byId = new Map(businesses.map((row) => [row.id, row]));
  const date = now.toISOString().slice(0, 10);

  for (const item of due) {
    result.processed += 1;
    const row = byId.get(item.businessId);
    if (!row) {
      await markMarketRefreshQueueItem(
        item.id,
        "failed",
        "Business is not onboarded"
      );
      result.failed += 1;
      continue;
    }

    await markMarketRefreshQueueItem(item.id, "running");
    try {
      const pulse = await runRankPulseForBusiness({
        row,
        observationDate: date,
        collectionDate: date,
        collectionType: "event_rank_pulse",
        keywordScope: item.keywordScope,
      });
      if (pulse.skipped) {
        await markMarketRefreshQueueItem(
          item.id,
          "skipped",
          pulse.skipReason
        );
        result.skipped += 1;
        continue;
      }
      await buildAndPersistLiveAuditForBusiness(row, date);
      await markMarketRefreshQueueItem(item.id, "completed");
      result.completed += 1;
      result.liftsFinalized += await finalizeDueReviewVelocityLifts(item.businessId);
    } catch (error) {
      await markMarketRefreshQueueItem(
        item.id,
        "failed",
        error instanceof Error ? error.message : String(error)
      );
      result.failed += 1;
    }
  }

  if (due.length === 0) {
    result.liftsFinalized = await finalizeDueReviewVelocityLifts();
  }

  return result;
}
