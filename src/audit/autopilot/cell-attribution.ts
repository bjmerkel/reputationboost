import type { ExecutionTask } from "@/audit/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadGridForDateAdmin } from "@/audit/storage-grid-snapshots";
import { evaluateExperimentOutcome } from "./experiment-lifecycle";
import { updateRankingExperimentAdmin } from "@/audit/storage-experiments";

export interface TargetCellCoords {
  gridNorth: number;
  gridEast: number;
}

export interface TargetCellAttribution {
  gridNorth: number;
  gridEast: number;
  rankBefore: number | null;
  rankAfter: number | null;
  rankDelta: number | null;
  targetCellImproved: boolean;
}

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function medianRank(ranks: Array<number | null>): number | null {
  const valid = ranks.filter((r): r is number => r !== null).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 0
    ? Math.round((valid[mid - 1]! + valid[mid]!) / 2)
    : valid[mid]!;
}

export function resolveTargetCellFromTask(
  task: ExecutionTask
): TargetCellCoords | null {
  const targetCell = task.payload.targetCell;
  if (
    targetCell &&
    typeof targetCell === "object" &&
    typeof (targetCell as { gridNorth?: unknown }).gridNorth === "number" &&
    typeof (targetCell as { gridEast?: unknown }).gridEast === "number"
  ) {
    return {
      gridNorth: Number((targetCell as { gridNorth: number }).gridNorth),
      gridEast: Number((targetCell as { gridEast: number }).gridEast),
    };
  }
  return null;
}

export function rankAtCell(
  grid: Awaited<ReturnType<typeof loadGridForDateAdmin>>,
  gridNorth: number,
  gridEast: number
): number | null {
  const point = grid.find(
    (cell) =>
      cell.offsetNorthMiles === gridNorth && cell.offsetEastMiles === gridEast
  );
  return point?.rank ?? null;
}

async function cellRankMedianInWindow(
  businessId: string,
  keyword: string,
  cell: TargetCellCoords,
  start: Date,
  end: Date
): Promise<number | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rank_snapshots")
    .select("rank, date")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .eq("grid_north", cell.gridNorth)
    .eq("grid_east", cell.gridEast)
    .gte("date", formatDateYmd(start))
    .lt("date", formatDateYmd(end))
    .order("date", { ascending: true });

  if (error || !data?.length) return null;
  return medianRank(data.map((row) => (row.rank as number | null) ?? null));
}

export async function computeTargetCellAttribution(params: {
  businessId: string;
  keyword: string;
  cell: TargetCellCoords;
  publishedAt: Date;
  windowDays: number;
  baselineSnapshotDate?: string;
  fallbackRankBefore?: number | null;
}): Promise<TargetCellAttribution> {
  const { businessId, keyword, cell, publishedAt, windowDays, baselineSnapshotDate } =
    params;
  const preStart = addDays(publishedAt, -windowDays);
  const preEnd = publishedAt;
  const postStart = publishedAt;
  const postEnd = addDays(publishedAt, windowDays);
  const now = new Date();
  const effectivePostEnd = now < postEnd ? now : postEnd;

  let rankBefore = await cellRankMedianInWindow(
    businessId,
    keyword,
    cell,
    preStart,
    preEnd
  );

  if (rankBefore == null && baselineSnapshotDate) {
    const baselineGrid = await loadGridForDateAdmin(
      businessId,
      keyword,
      baselineSnapshotDate
    );
    rankBefore = rankAtCell(baselineGrid, cell.gridNorth, cell.gridEast);
  }

  if (rankBefore == null && params.fallbackRankBefore !== undefined) {
    rankBefore = params.fallbackRankBefore;
  }

  const rankAfter = await cellRankMedianInWindow(
    businessId,
    keyword,
    cell,
    postStart,
    effectivePostEnd
  );

  const rankDelta =
    rankBefore != null && rankAfter != null ? rankAfter - rankBefore : null;
  const outcome = evaluateExperimentOutcome({ rankBefore, rankAfter });

  return {
    gridNorth: cell.gridNorth,
    gridEast: cell.gridEast,
    rankBefore,
    rankAfter,
    rankDelta,
    targetCellImproved: outcome.improved,
  };
}

export function formatTargetCellAttributionLine(
  attribution: Pick<
    TargetCellAttribution,
    "rankBefore" | "rankAfter" | "gridNorth" | "gridEast"
  >
): string {
  const formatRank = (rank: number | null) =>
    rank == null ? "not visible" : rank > 20 ? "#20+" : `#${rank}`;
  const direction =
    attribution.gridNorth === 0 && attribution.gridEast === 0
      ? "your location"
      : `${Math.abs(attribution.gridNorth).toFixed(1)} mi ${attribution.gridNorth >= 0 ? "N" : "S"} · ${Math.abs(attribution.gridEast).toFixed(1)} mi ${attribution.gridEast >= 0 ? "E" : "W"}`;
  return `Target cell (${direction}): ${formatRank(attribution.rankBefore)} → ${formatRank(attribution.rankAfter)}`;
}

export async function syncExperimentFromCellAttribution(params: {
  experimentId: string;
  cellAttribution: TargetCellAttribution;
  preliminary: boolean;
}): Promise<void> {
  const patch = {
    targetRankBefore: params.cellAttribution.rankBefore,
    targetRankAfter: params.cellAttribution.rankAfter,
    targetCellImproved: params.cellAttribution.targetCellImproved,
  };

  if (params.preliminary) {
    await updateRankingExperimentAdmin(params.experimentId, patch);
    return;
  }

  const outcome = evaluateExperimentOutcome({
    rankBefore: params.cellAttribution.rankBefore,
    rankAfter: params.cellAttribution.rankAfter,
  });

  await updateRankingExperimentAdmin(params.experimentId, {
    ...patch,
    status: outcome.status,
    concludedAt: new Date().toISOString(),
    conclusionReason: outcome.reason,
  });
}
