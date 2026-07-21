import type { GeoGridPoint } from "@/audit/types";
import { findNearestGridPoint } from "@/lib/geo/customer-to-cell";

export const LIFT_MEASUREMENT_MIN_DAYS = 5;
export const LIFT_MEASUREMENT_MAX_DAYS = 14;
export const LIFT_RESISTANCE_MIN_SAMPLES = 5;
export const LIFT_IMPROVEMENT_THRESHOLD = 3;
export const LIFT_RESISTANCE_THRESHOLD = 1;

export const KEYWORD_SCOPE_ALL = "__all__";

export function formatKeywordScope(keyword: string): string {
  return `keyword:${keyword.trim()}`;
}

export function parseKeywordScope(scope: string | null | undefined): string | null {
  if (!scope || scope === KEYWORD_SCOPE_ALL) return null;
  if (scope.startsWith("keyword:")) return scope.slice("keyword:".length);
  return scope;
}

export function rankAtCell(
  grid: GeoGridPoint[],
  gridNorth: number,
  gridEast: number
): { rank: number | null; inLocalPack: boolean } | null {
  const cell = findNearestGridPoint(grid, gridNorth, gridEast);
  if (!cell) return null;
  return { rank: cell.rank, inLocalPack: cell.inLocalPack };
}

export function computeLiftScore(input: {
  rankBefore: number | null;
  rankAfter: number | null;
  coverageBefore: number | null;
  coverageAfter: number | null;
}): number | null {
  const rankBefore = input.rankBefore;
  const rankAfter = input.rankAfter;
  let rankComponent: number | null = null;

  if (rankBefore != null && rankAfter != null) {
    rankComponent = rankBefore - rankAfter;
  } else if (rankBefore == null && rankAfter != null) {
    rankComponent = 20 - rankAfter;
  } else if (rankBefore != null && rankAfter == null) {
    rankComponent = -5;
  }

  const coverageBefore = input.coverageBefore ?? 0;
  const coverageAfter = input.coverageAfter ?? 0;
  const coverageComponent = coverageAfter - coverageBefore;

  if (rankComponent == null && coverageComponent === 0) return null;

  const score =
    (rankComponent ?? 0) * 0.7 +
    coverageComponent * 0.3;

  return Math.round(score * 100) / 100;
}

export function cellCoveragePercent(inLocalPack: boolean): number {
  return inLocalPack ? 100 : 0;
}

export function cellLiftKey(keyword: string, gridNorth: number, gridEast: number): string {
  return `${keyword.toLowerCase()}|${gridNorth}|${gridEast}`;
}

export function adjustWeaknessScoreForLift(
  baseScore: number,
  aggregate: {
    sampleCount: number;
    avgLiftScore: number;
    resistanceFlag: boolean;
  } | null
): number {
  if (!aggregate || aggregate.sampleCount === 0) return baseScore;

  let multiplier = 1;

  if (aggregate.avgLiftScore >= LIFT_IMPROVEMENT_THRESHOLD) {
    multiplier *= 0.65;
  } else if (aggregate.avgLiftScore <= -LIFT_IMPROVEMENT_THRESHOLD) {
    multiplier *= 1.15;
  }

  if (aggregate.resistanceFlag) {
    multiplier *= 0.55;
  }

  const adjusted = baseScore * multiplier;
  return Math.round(Math.min(100, Math.max(0, adjusted)) * 100) / 100;
}

export function buildLiftAdjustment(baseScore: number, adjustedScore: number): number {
  return Math.round((adjustedScore - baseScore) * 100) / 100;
}
