import type { GeoGridPoint } from "@/audit/types";

export type CellDiffStatus = "improved" | "regressed" | "unchanged" | "new" | "lost";

export interface CellDiff {
  lat: number;
  lng: number;
  offsetNorthMiles: number;
  offsetEastMiles: number;
  rankBefore: number | null;
  rankAfter: number | null;
  delta: number | null;
  status: CellDiffStatus;
}

export interface GridDiff {
  beforeDate: string;
  afterDate: string;
  keyword: string;
  cellsImproved: number;
  cellsRegressed: number;
  cellsUnchanged: number;
  coverageBefore: number;
  coverageAfter: number;
  coverageDelta: number;
  netCellsInPack: number;
  cellDiffs: CellDiff[];
}

function cellKey(point: Pick<GeoGridPoint, "offsetNorthMiles" | "offsetEastMiles">): string {
  return `${point.offsetNorthMiles.toFixed(3)}:${point.offsetEastMiles.toFixed(3)}`;
}

function coveragePercent(grid: GeoGridPoint[]): number {
  if (grid.length === 0) return 0;
  return Math.round((grid.filter((p) => p.inLocalPack).length / grid.length) * 100);
}

function classifyCellDiff(
  rankBefore: number | null | undefined,
  rankAfter: number | null | undefined
): { status: CellDiffStatus; delta: number | null } {
  const before = rankBefore ?? null;
  const after = rankAfter ?? null;

  if (before === null && after === null) {
    return { status: "unchanged", delta: null };
  }
  if (before === null && after !== null) {
    return { status: "new", delta: null };
  }
  if (before !== null && after === null) {
    return { status: "lost", delta: null };
  }
  if (before === after) {
    return { status: "unchanged", delta: 0 };
  }

  const delta = after! - before!;
  if (delta < 0) return { status: "improved", delta };
  return { status: "regressed", delta };
}

/** Compare two geo grids captured on different dates. */
export function computeGridDiff(
  beforeGrid: GeoGridPoint[],
  afterGrid: GeoGridPoint[],
  keyword: string,
  beforeDate: string,
  afterDate: string
): GridDiff {
  const beforeMap = new Map(beforeGrid.map((p) => [cellKey(p), p]));
  const afterMap = new Map(afterGrid.map((p) => [cellKey(p), p]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const cellDiffs: CellDiff[] = [];
  let cellsImproved = 0;
  let cellsRegressed = 0;
  let cellsUnchanged = 0;

  for (const key of keys) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);
    const { status, delta } = classifyCellDiff(before?.rank, after?.rank);

    if (status === "improved") cellsImproved += 1;
    else if (status === "regressed") cellsRegressed += 1;
    else cellsUnchanged += 1;

    const ref = after ?? before!;
    cellDiffs.push({
      lat: ref.lat,
      lng: ref.lng,
      offsetNorthMiles: ref.offsetNorthMiles,
      offsetEastMiles: ref.offsetEastMiles,
      rankBefore: before?.rank ?? null,
      rankAfter: after?.rank ?? null,
      delta,
      status,
    });
  }

  const coverageBefore = coveragePercent(beforeGrid);
  const coverageAfter = coveragePercent(afterGrid);
  const beforeInPack = beforeGrid.filter((p) => p.inLocalPack).length;
  const afterInPack = afterGrid.filter((p) => p.inLocalPack).length;

  return {
    beforeDate,
    afterDate,
    keyword,
    cellsImproved,
    cellsRegressed,
    cellsUnchanged,
    coverageBefore,
    coverageAfter,
    coverageDelta: coverageAfter - coverageBefore,
    netCellsInPack: afterInPack - beforeInPack,
    cellDiffs,
  };
}

export function diffCellColor(status: CellDiffStatus): string {
  switch (status) {
    case "improved":
      return "#34a853";
    case "regressed":
      return "#ea4335";
    case "new":
      return "#1a73e8";
    case "lost":
      return "#9aa0a6";
    default:
      return "#fbbc04";
  }
}
