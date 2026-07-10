import type { RankSnapshotRow } from "../types/timeseries";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";

export const DEFAULT_RANK_MEDIAN_WINDOW_DAYS = 7;

/** Median of numeric values; returns null when empty. */
export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/** Business-pin snapshots (excludes geo-grid spatial cells). */
export function isCenterSnapshot(row: RankSnapshotRow): boolean {
  return row.gridNorth === 0 && row.gridEast === 0;
}

function windowStartDate(endDate: string, windowDays: number): string {
  const end = new Date(`${endDate}T12:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() - (windowDays - 1));
  return end.toISOString().slice(0, 10);
}

/** Rolling median rank for one keyword at a target date and search radius. */
export function medianRankSnapshotForKeyword(
  snapshots: RankSnapshotRow[],
  keyword: string,
  targetDate: string,
  windowDays = DEFAULT_RANK_MEDIAN_WINDOW_DAYS,
  distanceMiles = 1
): RankSnapshotRow | null {
  const startDate = windowStartDate(targetDate, windowDays);
  const lower = keyword.toLowerCase();

  const windowSnaps = snapshots.filter(
    (s) =>
      s.keyword.toLowerCase() === lower &&
      s.date >= startDate &&
      s.date <= targetDate &&
      isCenterSnapshot(s) &&
      s.distanceMiles === distanceMiles
  );

  if (windowSnaps.length === 0) return null;

  const ranks = windowSnaps
    .map((s) => s.rank)
    .filter((r): r is number => r != null);
  const medianRank = medianOf(ranks);

  const inLocalPack = medianRank !== null && medianRank <= 3;

  return {
    businessId: windowSnaps[0].businessId,
    keyword: windowSnaps[0].keyword,
    date: targetDate,
    distanceMiles,
    gridNorth: 0,
    gridEast: 0,
    rank: medianRank,
    inLocalPack,
    localPackPosition: inLocalPack ? medianRank : null,
    source: windowSnaps[windowSnaps.length - 1].source,
  };
}

export interface SmoothRankSnapshotOptions {
  /** When true, smooth the business pin and weekly 1/3/5-mile ring medians. */
  multiRadius?: boolean;
}

/** Smooth daily center-point rank snapshots with a rolling median per keyword. */
export function smoothRankSnapshotsForDate(
  snapshots: RankSnapshotRow[],
  targetDate: string,
  keywords: string[],
  windowDays = DEFAULT_RANK_MEDIAN_WINDOW_DAYS,
  options: SmoothRankSnapshotOptions = {}
): RankSnapshotRow[] {
  const multiRadius = options.multiRadius ?? HEATMAP_FLAGS.dailyMultiRadius;
  const radii = multiRadius ? [0, ...RADIAL_RING_MILES] : [0];
  const rows: RankSnapshotRow[] = [];

  for (const keyword of keywords) {
    for (const distanceMiles of radii) {
      const smoothed = medianRankSnapshotForKeyword(
        snapshots,
        keyword,
        targetDate,
        windowDays,
        distanceMiles
      );
      if (smoothed) rows.push(smoothed);
    }
  }

  return rows;
}
