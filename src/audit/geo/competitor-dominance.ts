import type { GeoGridLocalPackEntry, GeoGridPoint } from "@/audit/types";

export interface CompetitorDominance {
  placeId: string;
  name: string;
  cellsOwned: number;
  weakCellsOwned: number;
  avgRating: number | null;
  avgReviewCount: number;
  threatScore: number;
  reviewGap: number;
}

function cellLeader(cell: GeoGridPoint): GeoGridLocalPackEntry | null {
  if (!cell.localPack?.length) return null;
  const weak = cell.rank === null || cell.rank > 3;
  if (!weak) return null;
  return cell.localPack[0] ?? null;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

/** Aggregate who owns weak cells across the geo grid. */
export function analyzeCompetitorDominance(
  grid: GeoGridPoint[],
  clientReviewCount = 0
): CompetitorDominance[] {
  const byPlace = new Map<
    string,
    {
      name: string;
      cellsOwned: number;
      weakCellsOwned: number;
      ratings: number[];
      reviewCounts: number[];
    }
  >();

  for (const cell of grid) {
    const leader = cellLeader(cell);
    if (!leader) continue;

    const existing = byPlace.get(leader.placeId) ?? {
      name: leader.name,
      cellsOwned: 0,
      weakCellsOwned: 0,
      ratings: [],
      reviewCounts: [],
    };

    existing.cellsOwned += 1;
    if (cell.rank === null || cell.rank > 3) {
      existing.weakCellsOwned += 1;
    }
    if (leader.rating != null) existing.ratings.push(leader.rating);
    if (leader.reviewCount > 0) existing.reviewCounts.push(leader.reviewCount);

    byPlace.set(leader.placeId, existing);
  }

  return [...byPlace.entries()]
    .map(([placeId, data]) => {
      const avgRating =
        data.ratings.length > 0
          ? Math.round((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length) * 10) / 10
          : null;
      const avgReviewCount =
        data.reviewCounts.length > 0
          ? Math.round(data.reviewCounts.reduce((a, b) => a + b, 0) / data.reviewCounts.length)
          : 0;
      const reviewGap = Math.max(0, avgReviewCount - clientReviewCount);

      return {
        placeId,
        name: data.name,
        cellsOwned: data.cellsOwned,
        weakCellsOwned: data.weakCellsOwned,
        avgRating,
        avgReviewCount,
        reviewGap,
        threatScore: data.weakCellsOwned * 10 + reviewGap,
      };
    })
    .sort((a, b) => b.threatScore - a.threatScore);
}

export function topCompetitorThreat(
  grid: GeoGridPoint[],
  clientReviewCount = 0
): CompetitorDominance | null {
  const ranked = analyzeCompetitorDominance(grid, clientReviewCount);
  return ranked[0] ?? null;
}

export function competitorInitials(name: string): string {
  return initials(name);
}

/** Label for a weak cell showing who ranks #1 there. */
export function cellDominanceLabel(cell: GeoGridPoint): string | null {
  if (cell.rank !== null && cell.rank <= 3) return null;
  const leader = cell.localPack?.[0];
  if (!leader) return null;
  return initials(leader.name);
}
