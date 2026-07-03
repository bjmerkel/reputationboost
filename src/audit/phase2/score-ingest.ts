import {
  applyRankSnapshotsToAudit,
  computeScoreDailySnapshot,
} from "@/audit/phase2/score-snapshot";
import {
  DEFAULT_RANK_MEDIAN_WINDOW_DAYS,
  smoothRankSnapshotsForDate,
} from "@/audit/phase2/rank-median";
import {
  listRankSnapshotsForBusinessRange,
  loadLatestAuditForBusinessAdmin,
  upsertScoreDaily,
} from "@/audit/storage-score-daily";
import { loadGlobalScoreModelAdmin } from "@/audit/storage-score-model";

function addDaysYmd(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Compute and store a daily listing strength snapshot after rank ingest. */
export async function ingestScoreDailyForBusiness(
  businessId: string,
  targetDate: string,
  windowDays = DEFAULT_RANK_MEDIAN_WINDOW_DAYS
): Promise<boolean> {
  const audit = await loadLatestAuditForBusinessAdmin(businessId);
  if (!audit) return false;

  const startDate = addDaysYmd(targetDate, -(windowDays - 1));
  const snapshots = await listRankSnapshotsForBusinessRange(
    businessId,
    startDate,
    targetDate
  );
  const keywords = audit.rankings.keywords.map((kw) => kw.keyword);
  const smoothed = smoothRankSnapshotsForDate(
    snapshots,
    targetDate,
    keywords,
    windowDays
  );
  const liveAudit = applyRankSnapshotsToAudit(audit, smoothed);
  const model = await loadGlobalScoreModelAdmin();
  const snapshot = computeScoreDailySnapshot(liveAudit, targetDate, "ingest", model);
  snapshot.businessId = businessId;

  await upsertScoreDaily(snapshot);
  return true;
}
