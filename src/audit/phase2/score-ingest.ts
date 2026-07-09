import {
  applyGridSnapshotsToAudit,
  applyRankSnapshotsToAudit,
  computeScoreDailySnapshot,
} from "@/audit/phase2/score-snapshot";
import { hydrateAuditFromTimeseries } from "@/audit/live-audit";
import { loadLatestAuditForBusinessAdmin, upsertScoreDaily } from "@/audit/storage-score-daily";
import { loadGlobalScoreModelAdmin } from "@/audit/storage-score-model";

/** Compute and store a daily listing strength snapshot after rank ingest. */
export async function ingestScoreDailyForBusiness(
  businessId: string,
  targetDate: string
): Promise<boolean> {
  const audit = await loadLatestAuditForBusinessAdmin(businessId);
  if (!audit) return false;

  const liveAudit = await hydrateAuditFromTimeseries(audit, businessId, {
    targetDate,
  });

  const model = await loadGlobalScoreModelAdmin();
  const snapshot = computeScoreDailySnapshot(liveAudit, targetDate, "ingest", model);
  snapshot.businessId = businessId;

  await upsertScoreDaily(snapshot);
  return true;
}

// Re-export for tests and score-history parity.
export { applyRankSnapshotsToAudit, applyGridSnapshotsToAudit };
