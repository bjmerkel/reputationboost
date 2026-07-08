import type { FullAuditPayload, GeoGridPoint, Phase1AuditPayload } from "../types";
import type { RankSnapshotRow, ScoreDailySnapshot } from "../types/timeseries";
import type { LearnedScoreModel } from "./score-learning";
import { DEFAULT_LEARNED_SCORE_MODEL } from "./score-learning";
import { computeHealthScores } from "./scoring";

function shareOfVoice(keywords: Phase1AuditPayload["rankings"]["keywords"]): number {
  if (keywords.length === 0) return 0;
  const inPack = keywords.filter((k) => k.inLocalPack).length;
  return Math.round((inPack / keywords.length) * 100);
}

function packPositionFromSnapshot(
  snap: RankSnapshotRow
): Phase1AuditPayload["rankings"]["keywords"][number]["localPackPosition"] {
  if (snap.inLocalPack && snap.localPackPosition != null) {
    return snap.localPackPosition as 1 | 2 | 3;
  }
  if (snap.inLocalPack && snap.rank != null && snap.rank <= 3) {
    return snap.rank as 1 | 2 | 3;
  }
  return "not_in_pack";
}

function groupCenterSnapshotsByKeyword(
  snapshots: RankSnapshotRow[]
): Map<string, RankSnapshotRow[]> {
  const byKeyword = new Map<string, RankSnapshotRow[]>();

  for (const snap of snapshots) {
    if (!isCenterSnapshot(snap)) continue;
    const key = snap.keyword.toLowerCase();
    const list = byKeyword.get(key) ?? [];
    list.push(snap);
    byKeyword.set(key, list);
  }

  return byKeyword;
}

function isCenterSnapshot(snap: RankSnapshotRow): boolean {
  return snap.gridNorth === 0 && snap.gridEast === 0;
}

/** Overlay daily rank snapshots onto a stored audit for live score computation. */
export function applyRankSnapshotsToAudit(
  audit: FullAuditPayload,
  snapshots: RankSnapshotRow[]
): FullAuditPayload {
  if (snapshots.length === 0) return audit;

  const byKeyword = groupCenterSnapshotsByKeyword(snapshots);

  const keywords = audit.rankings.keywords.map((kw) => {
    const snaps = byKeyword.get(kw.keyword.toLowerCase());
    if (!snaps?.length) return kw;

    const snapByRadius = new Map(snaps.map((s) => [s.distanceMiles, s]));
    const snap1mi = snapByRadius.get(1);

    return {
      ...kw,
      localPackPosition: snap1mi ? packPositionFromSnapshot(snap1mi) : kw.localPackPosition,
      inLocalPack: snap1mi ? snap1mi.inLocalPack : kw.inLocalPack,
      geoRanks: kw.geoRanks.map((g) => {
        const snap = snapByRadius.get(g.distanceMiles);
        if (!snap) return g;
        return {
          ...g,
          rank: snap.rank,
          inLocalPack: snap.inLocalPack,
        };
      }),
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

/** Replace audit geo-grids with the latest weekly/task grid snapshots. */
export function applyGridSnapshotsToAudit(
  audit: FullAuditPayload,
  gridsByKeyword: Map<string, GeoGridPoint[]>
): FullAuditPayload {
  if (gridsByKeyword.size === 0) return audit;

  const keywords = audit.rankings.keywords.map((kw) => {
    const grid =
      gridsByKeyword.get(kw.keyword) ?? gridsByKeyword.get(kw.keyword.toLowerCase());
    if (!grid?.length) return kw;
    return { ...kw, geoGrid: grid };
  });

  return {
    ...audit,
    rankings: {
      ...audit.rankings,
      keywords,
    },
  };
}

export function computeScoreDailySnapshot(
  audit: Phase1AuditPayload,
  date: string,
  source: ScoreDailySnapshot["source"] = "ingest",
  model: LearnedScoreModel | null = DEFAULT_LEARNED_SCORE_MODEL
): ScoreDailySnapshot {
  const scores = computeHealthScores(audit, model);
  return {
    businessId: audit.clientId,
    date,
    overall: scores.overall,
    driverScore: scores.driverScore,
    outcomeIndex: scores.outcomeIndex,
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
