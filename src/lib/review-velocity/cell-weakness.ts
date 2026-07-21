import type { GeoGridPoint } from "@/audit/types";
import type { ZoneDirection } from "@/audit/geo/types";
import { classifyCellZone } from "@/lib/geo/customer-to-cell";

export interface CellWeaknessScore {
  keyword: string;
  gridNorth: number;
  gridEast: number;
  zoneDirection: ZoneDirection;
  rank: number | null;
  inLocalPack: boolean;
  reviewGap: number;
  weaknessScore: number;
}

function rankPenalty(rank: number | null): number {
  if (rank === null) return 100;
  if (rank > 20) return 85;
  if (rank > 10) return 70;
  if (rank > 3) return 50;
  return 25;
}

/** Composite 0–100 score — higher means the cell needs review velocity more. */
export function computeWeaknessScoreForCell(
  cell: Pick<GeoGridPoint, "rank" | "inLocalPack">,
  reviewGap: number
): number {
  const gapFactor = Math.min(1, Math.max(0, reviewGap / 50));
  const packMultiplier = cell.inLocalPack ? 0.35 : 1;
  const raw = rankPenalty(cell.rank) * packMultiplier * (0.5 + gapFactor * 0.5);
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}

export function computeCellWeaknessScores(
  keyword: string,
  grid: GeoGridPoint[],
  reviewGap: number
): CellWeaknessScore[] {
  return grid.map((cell) => ({
    keyword,
    gridNorth: cell.offsetNorthMiles,
    gridEast: cell.offsetEastMiles,
    zoneDirection: classifyCellZone(cell.offsetNorthMiles, cell.offsetEastMiles),
    rank: cell.rank,
    inLocalPack: cell.inLocalPack,
    reviewGap,
    weaknessScore: computeWeaknessScoreForCell(cell, reviewGap),
  }));
}

export function buildKeywordWeaknessIndex(
  keywordGrids: Map<string, GeoGridPoint[]>,
  reviewGaps: Map<string, number>
): CellWeaknessScore[] {
  const scores: CellWeaknessScore[] = [];

  for (const [keyword, grid] of keywordGrids) {
    const reviewGap = reviewGaps.get(keyword) ?? 0;
    scores.push(...computeCellWeaknessScores(keyword, grid, reviewGap));
  }

  return scores.sort((a, b) => b.weaknessScore - a.weaknessScore);
}

export function weaknessScoresForCell(
  scores: CellWeaknessScore[],
  gridNorth: number,
  gridEast: number,
  tolerance = 0.15
): CellWeaknessScore[] {
  return scores
    .filter(
      (score) =>
        Math.abs(score.gridNorth - gridNorth) <= tolerance &&
        Math.abs(score.gridEast - gridEast) <= tolerance
    )
    .sort((a, b) => b.weaknessScore - a.weaknessScore);
}

export function isCellStrongEnoughToSkip(scores: CellWeaknessScore[]): boolean {
  if (scores.length === 0) return false;
  const best = scores[0];
  return best.inLocalPack && best.weaknessScore < 30;
}
