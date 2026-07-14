import { listOnboardedBusinesses } from "@/audit/businesses-admin";
import { buildAndPersistLiveAuditForBusiness } from "@/audit/live-audit";
import {
  listDueMarketRefreshes,
  markMarketRefreshQueueItem,
} from "@/audit/market/refresh-queue";
import { runRankPulseForBusiness } from "@/audit/market/rank-pulse";

export interface ProcessMarketRefreshResult {
  processed: number;
  completed: number;
  skipped: number;
  failed: number;
}

export async function processDueMarketRefreshes(
  now = new Date()
): Promise<ProcessMarketRefreshResult> {
  const result = { processed: 0, completed: 0, skipped: 0, failed: 0 };
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
    } catch (error) {
      await markMarketRefreshQueueItem(
        item.id,
        "failed",
        error instanceof Error ? error.message : String(error)
      );
      result.failed += 1;
    }
  }

  return result;
}
