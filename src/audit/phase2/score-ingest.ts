import {
  applyGridSnapshotsToAudit,
  applyRankSnapshotsToAudit,
  computeScoreDailySnapshot,
} from "@/audit/phase2/score-snapshot";
import { hydrateAuditFromTimeseries } from "@/audit/live-audit";
import {
  listRankSnapshotsForBusinessRange,
  listScoreDailyForBusinessAdmin,
  loadLatestAuditForBusinessAdmin,
  upsertScoreDaily,
} from "@/audit/storage-score-daily";
import { loadGlobalScoreModelAdmin } from "@/audit/storage-score-model";

function addDaysYmd(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Rank snapshot dates that do not yet have a score_daily row. */
export function datesMissingScoreSnapshots(
  rankDates: string[],
  existingDates: Iterable<string>
): string[] {
  const existing = new Set(existingDates);
  return [...new Set(rankDates)].filter((date) => !existing.has(date)).sort();
}

async function writeScoreDailyForDate(
  businessId: string,
  audit: NonNullable<Awaited<ReturnType<typeof loadLatestAuditForBusinessAdmin>>>,
  targetDate: string,
  source: "ingest" | "audit"
): Promise<void> {
  const liveAudit = await hydrateAuditFromTimeseries(audit, businessId, {
    targetDate,
  });
  const model = await loadGlobalScoreModelAdmin();
  const snapshot = computeScoreDailySnapshot(liveAudit, targetDate, source, model);
  snapshot.businessId = businessId;
  await upsertScoreDaily(snapshot);
}

/**
 * Fill score_daily for rank-ingest dates that were collected before an audit
 * existed (or before score snapshots were enabled).
 */
export async function backfillScoreDailyForBusiness(
  businessId: string,
  days = 30
): Promise<number> {
  const audit = await loadLatestAuditForBusinessAdmin(businessId);
  if (!audit) return 0;

  const endDate = formatDateYmd(new Date());
  const startDate = addDaysYmd(endDate, -days);
  const [existing, rankSnapshots] = await Promise.all([
    listScoreDailyForBusinessAdmin(businessId, days),
    listRankSnapshotsForBusinessRange(businessId, startDate, endDate),
  ]);

  const missingDates = datesMissingScoreSnapshots(
    rankSnapshots.map((row) => row.date),
    existing.map((row) => row.date)
  );

  for (const date of missingDates) {
    await writeScoreDailyForDate(businessId, audit, date, "ingest");
  }

  return missingDates.length;
}

/** Compute and store a daily listing strength snapshot after rank ingest. */
export async function ingestScoreDailyForBusiness(
  businessId: string,
  targetDate: string
): Promise<boolean> {
  const audit = await loadLatestAuditForBusinessAdmin(businessId);
  if (!audit) return false;

  await writeScoreDailyForDate(businessId, audit, targetDate, "ingest");
  return true;
}

// Re-export for tests and score-history parity.
export { applyRankSnapshotsToAudit, applyGridSnapshotsToAudit };
