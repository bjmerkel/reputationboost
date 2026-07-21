import type { FullAuditPayload, GeoGridPoint, Phase1AuditPayload } from "@/audit/types";
import { classifyLosingCells } from "./cell-loss-classifier";
import {
  buildClientProfileSnapshot,
  computeLeaderDelta,
  formatCellDirection,
} from "./leader-delta-engine";
import {
  buildCompetitorProfileIndex,
  resolveCompetitorProfile,
} from "./competitor-profile-index";
import { deriveMarketKey } from "./market-key";
import type { MarketCalibrationIndex } from "./market-calibration";
import type { RankingExperiment, RankingExperimentStatus } from "./types";

export type CellExperimentStatus =
  | RankingExperimentStatus
  | "none"
  | "available";

export interface CellPortfolioEntry {
  keyword: string;
  gridNorth: number;
  gridEast: number;
  rank: number | null;
  priority: number;
  leaderName: string;
  leaderPlaceId: string;
  directionLabel: string;
  experimentStatus: CellExperimentStatus;
  experimentId: string | null;
  topHypothesis: string | null;
  impressions: number;
}

function cellKey(keyword: string, north: number, east: number): string {
  return `${keyword.toLowerCase()}::${north}::${east}`;
}

function keywordImpressions(
  audit: Phase1AuditPayload | FullAuditPayload,
  keyword: string
): number {
  return (
    audit.gbp.performance.searchKeywords?.find(
      (row) => row.keyword.toLowerCase() === keyword.toLowerCase()
    )?.impressions ?? 0
  );
}

function experimentStatusForCell(
  experiments: RankingExperiment[],
  keyword: string,
  gridNorth: number,
  gridEast: number
): { status: CellExperimentStatus; experimentId: string | null } {
  const match = experiments.find(
    (experiment) =>
      experiment.keyword.toLowerCase() === keyword.toLowerCase() &&
      experiment.gridNorth === gridNorth &&
      experiment.gridEast === gridEast &&
      experiment.status !== "cancelled"
  );
  if (!match) return { status: "none", experimentId: null };
  if (match.status === "proposed" && match.origin === "suggested") {
    return { status: "proposed", experimentId: match.id };
  }
  return { status: match.status, experimentId: match.id };
}

export function buildCellPortfolio(params: {
  audit: FullAuditPayload;
  experiments?: RankingExperiment[];
  marketIndex?: MarketCalibrationIndex;
  limit?: number;
}): CellPortfolioEntry[] {
  const experiments = params.experiments ?? [];
  const marketKey = deriveMarketKey(params.audit);
  const marketIndex = params.marketIndex ?? new Map();
  const competitorIndex = buildCompetitorProfileIndex(params.audit.competitors);
  const client = buildClientProfileSnapshot(params.audit.gbp);
  const entries: CellPortfolioEntry[] = [];

  for (const snapshot of params.audit.rankings.keywords) {
    if (!snapshot.geoGrid?.length) continue;
    const impressions = keywordImpressions(params.audit, snapshot.keyword);
    const impressionsWeight = impressions > 0 ? Math.log10(impressions + 10) : 1;
    const losing = classifyLosingCells(snapshot.geoGrid, impressionsWeight);

    for (const cellSummary of losing) {
      const cell = snapshot.geoGrid.find(
        (point: GeoGridPoint) =>
          point.offsetNorthMiles === cellSummary.gridNorth &&
          point.offsetEastMiles === cellSummary.gridEast
      );
      if (!cell) continue;

      const leaderProfile = resolveCompetitorProfile(
        competitorIndex,
        snapshot.keyword,
        cellSummary.leaderPlaceId
      );
      const delta = computeLeaderDelta({
        keyword: snapshot.keyword,
        cell,
        client,
        leaderProfile,
        marketKey,
        marketIndex,
      });
      const experiment = experimentStatusForCell(
        experiments,
        snapshot.keyword,
        cellSummary.gridNorth,
        cellSummary.gridEast
      );

      entries.push({
        keyword: snapshot.keyword,
        gridNorth: cellSummary.gridNorth,
        gridEast: cellSummary.gridEast,
        rank: cellSummary.rank,
        priority: cellSummary.priority,
        leaderName: cellSummary.leaderName,
        leaderPlaceId: cellSummary.leaderPlaceId,
        directionLabel: formatCellDirection(cellSummary.gridNorth, cellSummary.gridEast),
        experimentStatus:
          experiment.status === "none" && (delta?.rankedActions.length ?? 0) > 0
            ? "available"
            : experiment.status,
        experimentId: experiment.experimentId,
        topHypothesis: delta?.rankedActions[0]?.hypothesis ?? null,
        impressions,
      });
    }
  }

  return entries
    .sort((a, b) => {
      if (a.experimentStatus === "pending_approval") return -1;
      if (b.experimentStatus === "pending_approval") return 1;
      if (a.experimentStatus === "proposed") return -1;
      if (b.experimentStatus === "proposed") return 1;
      return b.priority - a.priority || b.impressions - a.impressions;
    })
    .slice(0, params.limit ?? 12);
}

export function cellPortfolioIndex(
  entries: CellPortfolioEntry[]
): Map<string, CellPortfolioEntry> {
  const map = new Map<string, CellPortfolioEntry>();
  for (const entry of entries) {
    map.set(cellKey(entry.keyword, entry.gridNorth, entry.gridEast), entry);
  }
  return map;
}
