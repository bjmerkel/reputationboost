import {
  applyRankSnapshotsToAudit,
  computeScoreDailySnapshot,
} from "@/audit/phase2/score-snapshot";
import {
  listRankSnapshotsForBusinessDate,
  loadLatestAuditForBusinessAdmin,
  upsertScoreDaily,
} from "@/audit/storage-score-daily";

/** Compute and store a daily listing strength snapshot after rank ingest. */
export async function ingestScoreDailyForBusiness(
  businessId: string,
  targetDate: string
): Promise<boolean> {
  const audit = await loadLatestAuditForBusinessAdmin(businessId);
  if (!audit) return false;

  const snapshots = await listRankSnapshotsForBusinessDate(businessId, targetDate);
  const liveAudit = applyRankSnapshotsToAudit(audit, snapshots);
  const snapshot = computeScoreDailySnapshot(liveAudit, targetDate, "ingest");
  snapshot.businessId = businessId;

  await upsertScoreDaily(snapshot);
  return true;
}
