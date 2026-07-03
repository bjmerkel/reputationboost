import type { FullAuditPayload, Phase1AuditPayload } from "../types";
import type { RankSnapshotRow, ScoreDailySnapshot } from "../types/timeseries";
import { computeHealthScores } from "./scoring";

function shareOfVoice(keywords: Phase1AuditPayload["rankings"]["keywords"]): number {
  if (keywords.length === 0) return 0;
  const inPack = keywords.filter((k) => k.inLocalPack).length;
  return Math.round((inPack / keywords.length) * 100);
}

/** Overlay daily rank snapshots onto a stored audit for live score computation. */
export function applyRankSnapshotsToAudit(
  audit: FullAuditPayload,
  snapshots: RankSnapshotRow[]
): FullAuditPayload {
  if (snapshots.length === 0) return audit;

  const byKeyword = new Map(snapshots.map((s) => [s.keyword.toLowerCase(), s]));

  const keywords = audit.rankings.keywords.map((kw) => {
    const snap = byKeyword.get(kw.keyword.toLowerCase());
    if (!snap) return kw;

    const packPos =
      snap.inLocalPack && snap.localPackPosition != null
        ? (snap.localPackPosition as 1 | 2 | 3)
        : snap.inLocalPack && snap.rank != null && snap.rank <= 3
          ? (snap.rank as 1 | 2 | 3)
          : ("not_in_pack" as const);

    return {
      ...kw,
      localPackPosition: packPos,
      inLocalPack: snap.inLocalPack,
      geoRanks: kw.geoRanks.map((g) =>
        g.distanceMiles === 1
          ? { ...g, rank: snap.rank, inLocalPack: snap.inLocalPack }
          : g
      ),
    };
  });

  const keywordsInPack = keywords.filter((k) => k.inLocalPack).length;

  return {
    ...audit,
    rankings: {
      ...audit.rankings,
      keywords,
      keywordsInPack,
      totalKeywords: keywords.length,
      shareOfVoice: shareOfVoice(keywords),
    },
  };
}

export function computeScoreDailySnapshot(
  audit: Phase1AuditPayload,
  date: string,
  source: ScoreDailySnapshot["source"] = "ingest"
): ScoreDailySnapshot {
  const scores = computeHealthScores(audit);
  return {
    businessId: audit.clientId,
    date,
    overall: scores.overall,
    visibility: scores.visibility,
    conversion: scores.conversion,
    revenueCapture: scores.revenueCapture,
    source,
  };
}

export function rankSnapshotsForDate(
  rows: RankSnapshotRow[],
  date: string
): RankSnapshotRow[] {
  return rows.filter((r) => r.date === date);
}
