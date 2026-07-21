import type { GeoGridPoint } from "@/audit/types";
import type { LosingCell } from "./types";

function cellLeader(cell: GeoGridPoint) {
  return cell.localPack?.[0] ?? null;
}

function rankSeverity(rank: number | null): number {
  if (rank === null) return 4;
  if (rank > 10) return 3;
  if (rank > 3) return 2;
  return 1;
}

/** True when the client is outside the local 3-pack in this cell. */
export function isLosingCell(cell: GeoGridPoint): boolean {
  return cell.rank === null || cell.rank > 3;
}

/** Collect losing cells with a simple severity-based priority score. */
export function classifyLosingCells(
  grid: GeoGridPoint[],
  impressionsWeight = 1
): LosingCell[] {
  const losing: LosingCell[] = [];

  for (const cell of grid) {
    if (!isLosingCell(cell)) continue;
    const leader = cellLeader(cell);
    if (!leader) continue;

    losing.push({
      gridNorth: cell.offsetNorthMiles,
      gridEast: cell.offsetEastMiles,
      rank: cell.rank,
      leaderPlaceId: leader.placeId,
      leaderName: leader.name,
      priority: rankSeverity(cell.rank) * impressionsWeight,
    });
  }

  return losing.sort((a, b) => b.priority - a.priority);
}
