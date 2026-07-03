import type { RankSnapshotRow, ScoreDailySnapshot } from "../types/timeseries";

export const DEFAULT_BACKTEST_HORIZON_DAYS = 28;

export interface BacktestSample {
  businessId: string;
  keyword: string;
  date: string;
  overall: number;
  visibility: number;
  conversion: number;
  revenueCapture: number;
  rank: number | null;
  inLocalPack: boolean;
  horizonDate: string;
  rankAtHorizon: number | null;
  inPackAtHorizon: boolean;
  rankDelta: number | null;
  rankImproved: boolean;
  enteredPack: boolean;
}

export interface BacktestMetrics {
  sampleCount: number;
  horizonDays: number;
  conversionRankDeltaCorrelation: number | null;
  visibilityRankDeltaCorrelation: number | null;
  overallRankDeltaCorrelation: number | null;
  conversionPackEntryRate: number | null;
  lowConversionPackEntryRate: number | null;
  packEntryLift: number | null;
}

function addDaysYmd(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function isCenterSnapshot(row: RankSnapshotRow): boolean {
  return row.distanceMiles === 1 && row.gridNorth === 0 && row.gridEast === 0;
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;

  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return Math.round((num / den) * 1000) / 1000;
}

function rankByDateKeyword(
  ranks: RankSnapshotRow[]
): Map<string, RankSnapshotRow> {
  const map = new Map<string, RankSnapshotRow>();
  for (const row of ranks) {
    if (!isCenterSnapshot(row)) continue;
    map.set(`${row.date}|${row.keyword.toLowerCase()}`, row);
  }
  return map;
}

/**
 * Build labeled samples: score components at T vs rank outcome at T+horizon.
 * Negative rankDelta means improvement (lower rank number is better).
 */
export function buildBacktestSamples(
  scores: ScoreDailySnapshot[],
  ranks: RankSnapshotRow[],
  horizonDays = DEFAULT_BACKTEST_HORIZON_DAYS
): BacktestSample[] {
  const rankIndex = rankByDateKeyword(ranks);
  const samples: BacktestSample[] = [];

  for (const score of scores) {
    for (const row of ranks) {
      if (row.businessId !== score.businessId) continue;
      if (!isCenterSnapshot(row)) continue;
      if (row.date !== score.date) continue;

      const horizonDate = addDaysYmd(score.date, horizonDays);
      const horizonRow = rankIndex.get(
        `${horizonDate}|${row.keyword.toLowerCase()}`
      );
      if (!horizonRow) continue;

      const rankDelta =
        row.rank != null && horizonRow.rank != null
          ? horizonRow.rank - row.rank
          : null;

      samples.push({
        businessId: score.businessId,
        keyword: row.keyword,
        date: score.date,
        overall: score.overall,
        visibility: score.visibility,
        conversion: score.conversion,
        revenueCapture: score.revenueCapture,
        rank: row.rank,
        inLocalPack: row.inLocalPack,
        horizonDate,
        rankAtHorizon: horizonRow.rank,
        inPackAtHorizon: horizonRow.inLocalPack,
        rankDelta,
        rankImproved: rankDelta !== null && rankDelta < 0,
        enteredPack: !row.inLocalPack && horizonRow.inLocalPack,
      });
    }
  }

  return samples;
}

/**
 * Evaluate whether score components at T predict rank movement at T+horizon.
 * conversion should correlate negatively with rankDelta (higher conversion → rank improves).
 */
export function evaluateBacktestMetrics(
  samples: BacktestSample[],
  horizonDays = DEFAULT_BACKTEST_HORIZON_DAYS
): BacktestMetrics {
  const withDelta = samples.filter((s) => s.rankDelta !== null);

  const conversionRankDeltaCorrelation = pearsonCorrelation(
    withDelta.map((s) => s.conversion),
    withDelta.map((s) => s.rankDelta!)
  );
  const visibilityRankDeltaCorrelation = pearsonCorrelation(
    withDelta.map((s) => s.visibility),
    withDelta.map((s) => s.rankDelta!)
  );
  const overallRankDeltaCorrelation = pearsonCorrelation(
    withDelta.map((s) => s.overall),
    withDelta.map((s) => s.rankDelta!)
  );

  const outsidePack = samples.filter((s) => !s.inLocalPack);
  const medianConversion =
    outsidePack.length > 0
      ? median(outsidePack.map((s) => s.conversion)) ?? 0
      : 0;

  const highConversion = outsidePack.filter((s) => s.conversion >= medianConversion);
  const lowConversion = outsidePack.filter((s) => s.conversion < medianConversion);

  const rate = (rows: BacktestSample[]) =>
    rows.length > 0 ? rows.filter((s) => s.enteredPack).length / rows.length : null;

  const conversionPackEntryRate = rate(highConversion);
  const lowConversionPackEntryRate = rate(lowConversion);
  const packEntryLift =
    conversionPackEntryRate != null && lowConversionPackEntryRate != null
      ? Math.round((conversionPackEntryRate - lowConversionPackEntryRate) * 1000) / 1000
      : null;

  return {
    sampleCount: samples.length,
    horizonDays,
    conversionRankDeltaCorrelation,
    visibilityRankDeltaCorrelation,
    overallRankDeltaCorrelation,
    conversionPackEntryRate,
    lowConversionPackEntryRate,
    packEntryLift,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
