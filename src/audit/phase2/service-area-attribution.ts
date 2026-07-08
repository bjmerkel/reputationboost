import type { KeywordRankSnapshot, RankMovement } from "../types";
import type { RankSnapshotRow } from "../types/timeseries";
import { SEARCH_RADII_MILES } from "@/lib/google/places";
import { medianOf } from "./rank-median";
import type { RadiusWeights } from "./radius-profiles";
import {
  detectPackFragility,
  keywordServiceAreaVisibilityScore,
  resolveKeywordPositionAtRadius,
} from "./scoring";

export interface RadiusRankMedian {
  distanceMiles: number;
  rank: number | null;
}

/** Median rank per search radius from center-point snapshot rows. */
export function medianRanksByRadius(
  snapshots: Array<{ distanceMiles: number; rank: number | null }>
): Map<number, number | null> {
  const byRadius = new Map<number, number[]>();

  for (const snap of snapshots) {
    if (snap.rank == null) continue;
    const list = byRadius.get(snap.distanceMiles) ?? [];
    list.push(snap.rank);
    byRadius.set(snap.distanceMiles, list);
  }

  const result = new Map<number, number | null>();
  for (const miles of SEARCH_RADII_MILES) {
    result.set(miles, medianOf(byRadius.get(miles) ?? []));
  }
  return result;
}

/** Build a keyword snapshot from per-radius medians for visibility scoring. */
export function buildKeywordFromRadiusMedians(
  keyword: string,
  radiusMedians: Map<number, number | null>,
  template?: KeywordRankSnapshot
): KeywordRankSnapshot {
  const geoRanks = SEARCH_RADII_MILES.map((distanceMiles) => {
    const rank = radiusMedians.get(distanceMiles) ?? null;
    const inLocalPack = rank !== null && rank <= 3;
    return { distanceMiles, rank, inLocalPack };
  });

  const rank1 = radiusMedians.get(1);
  const inLocalPack = rank1 != null && rank1 <= 3;

  return {
    keyword,
    localPackPosition:
      inLocalPack && rank1 != null ? (rank1 as 1 | 2 | 3) : ("not_in_pack" as const),
    inLocalPack,
    geoRanks,
    packLeaderRating: template?.packLeaderRating ?? 0,
    packLeaderReviewCount: template?.packLeaderReviewCount ?? 0,
    clientRating: template?.clientRating ?? 0,
    clientReviewCount: template?.clientReviewCount ?? 0,
    geoGrid: template?.geoGrid,
  };
}

export function serviceAreaVisibilityDelta(
  before: KeywordRankSnapshot,
  after: KeywordRankSnapshot,
  weights: RadiusWeights
): number {
  return (
    keywordServiceAreaVisibilityScore(after, weights) -
    keywordServiceAreaVisibilityScore(before, weights)
  );
}

export function serviceAreaImproved(
  before: KeywordRankSnapshot,
  after: KeywordRankSnapshot,
  weights: RadiusWeights,
  minDelta = 1
): boolean {
  return serviceAreaVisibilityDelta(before, after, weights) >= minDelta;
}

/** Radius where a previously fragile keyword gained pack position, if any. */
export function weakestRadiusImproved(
  before: KeywordRankSnapshot,
  after: KeywordRankSnapshot
): number | null {
  const fragility = detectPackFragility(before);
  if (!fragility.fragile || fragility.weakestRadiusMiles == null) return null;

  const miles = fragility.weakestRadiusMiles;
  const beforeRank = resolveKeywordPositionAtRadius(before, miles);
  const afterRank = resolveKeywordPositionAtRadius(after, miles);
  if (typeof beforeRank !== "number" || typeof afterRank !== "number") return null;
  return afterRank < beforeRank ? miles : null;
}

function numericRank(position: number | "not_in_pack" | null): number | null {
  if (position == null || position === "not_in_pack") return null;
  return position;
}

/** Compare keyword snapshots across dates using service-area visibility and per-radius ranks. */
export function buildServiceAreaRankMovements(
  keywords: string[],
  priorKeywords: Map<string, KeywordRankSnapshot>,
  currentKeywords: Map<string, KeywordRankSnapshot>,
  weights: RadiusWeights
): RankMovement[] {
  const movements: RankMovement[] = [];

  for (const keyword of keywords) {
    const prior = priorKeywords.get(keyword);
    const current = currentKeywords.get(keyword);
    if (!prior || !current) continue;

    const priorVis = keywordServiceAreaVisibilityScore(prior, weights);
    const curVis = keywordServiceAreaVisibilityScore(current, weights);
    const fromPos = numericRank(resolveKeywordPositionAtRadius(prior, 1));
    const toPos = numericRank(resolveKeywordPositionAtRadius(current, 1));

    if (priorVis === curVis && fromPos === toPos) continue;

    const improved =
      curVis > priorVis ||
      (fromPos != null && toPos != null && toPos < fromPos) ||
      (fromPos == null && toPos != null && toPos <= 3);

    const widerRadius = weakestRadiusImproved(prior, current);
    const highlightRadiusMiles =
      fromPos !== toPos ? 1 : widerRadius ?? (curVis !== priorVis ? 3 : null);

    movements.push({
      keyword,
      fromPosition: fromPos,
      toPosition: toPos,
      improved,
      fromServiceAreaVisibility: priorVis,
      toServiceAreaVisibility: curVis,
      highlightRadiusMiles,
    });
  }

  return movements.sort((a, b) => {
    const aVisDelta = (a.toServiceAreaVisibility ?? 0) - (a.fromServiceAreaVisibility ?? 0);
    const bVisDelta = (b.toServiceAreaVisibility ?? 0) - (b.fromServiceAreaVisibility ?? 0);
    if (bVisDelta !== aVisDelta) return bVisDelta - aVisDelta;
    const aRankDelta = (a.fromPosition ?? 99) - (a.toPosition ?? 99);
    const bRankDelta = (b.fromPosition ?? 99) - (b.toPosition ?? 99);
    return bRankDelta - aRankDelta;
  });
}

/** Overlay smoothed center snapshots onto audit keywords for a single date. */
export function keywordMapFromRankSnapshots(
  audit: { rankings: { keywords: KeywordRankSnapshot[] } },
  snapshots: RankSnapshotRow[]
): Map<string, KeywordRankSnapshot> {
  const byKeyword = new Map<string, RankSnapshotRow[]>();
  for (const snap of snapshots) {
    if (snap.gridNorth !== 0 || snap.gridEast !== 0) continue;
    const key = snap.keyword.toLowerCase();
    const list = byKeyword.get(key) ?? [];
    list.push(snap);
    byKeyword.set(key, list);
  }

  const result = new Map<string, KeywordRankSnapshot>();
  for (const kw of audit.rankings.keywords) {
    const snaps = byKeyword.get(kw.keyword.toLowerCase());
    if (!snaps?.length) {
      result.set(kw.keyword, kw);
      continue;
    }
    const medians = medianRanksByRadius(
      snaps.map((s) => ({ distanceMiles: s.distanceMiles, rank: s.rank }))
    );
    result.set(kw.keyword, buildKeywordFromRadiusMedians(kw.keyword, medians, kw));
  }
  return result;
}
