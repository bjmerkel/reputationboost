import type { ScoreDailySnapshot } from "../types/timeseries";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveDriverScore(snapshot: ScoreDailySnapshot): number {
  return snapshot.driverScore ?? snapshot.conversion;
}

function resolveOutcomeIndex(snapshot: ScoreDailySnapshot): number {
  return (
    snapshot.outcomeIndex ??
    Math.round(snapshot.visibility * 0.6 + snapshot.revenueCapture * 0.4)
  );
}

/** Median driver score across daily snapshots in a date range (inclusive). */
export function medianDriverScoreInRange(
  snapshots: ScoreDailySnapshot[],
  startDate: string,
  endDate: string
): number | null {
  const values = snapshots
    .filter((row) => row.date >= startDate && row.date <= endDate)
    .map(resolveDriverScore);
  return median(values);
}

/** Median outcome index across daily snapshots in a date range (inclusive). */
export function medianOutcomeIndexInRange(
  snapshots: ScoreDailySnapshot[],
  startDate: string,
  endDate: string
): number | null {
  const values = snapshots
    .filter((row) => row.date >= startDate && row.date <= endDate)
    .map(resolveOutcomeIndex);
  return median(values);
}

export interface ObservedDriverImpact {
  driverScoreBefore: number | null;
  driverScoreAfter: number | null;
  observedDriverImpact: number | null;
  preliminary: boolean;
}

/** Observed driver-score change from daily snapshots around a published action. */
export function computeObservedDriverImpact(
  snapshots: ScoreDailySnapshot[],
  publishedAt: string,
  windowDays = 14,
  now: Date = new Date()
): ObservedDriverImpact {
  const published = new Date(publishedAt);
  const preStart = addDays(published, -windowDays);
  const preEnd = published;
  const postStart = published;
  const postEnd = addDays(published, windowDays);
  const effectivePostEnd = now < postEnd ? now : postEnd;

  const driverScoreBefore = medianDriverScoreInRange(
    snapshots,
    formatDateYmd(preStart),
    formatDateYmd(addDays(preEnd, -1))
  );
  const driverScoreAfter = medianDriverScoreInRange(
    snapshots,
    formatDateYmd(postStart),
    formatDateYmd(addDays(effectivePostEnd, -1))
  );

  const observedDriverImpact =
    driverScoreBefore != null && driverScoreAfter != null
      ? driverScoreAfter - driverScoreBefore
      : null;

  return {
    driverScoreBefore,
    driverScoreAfter,
    observedDriverImpact,
    preliminary: now < postEnd,
  };
}

export interface ObservedOutcomeImpact {
  outcomeIndexBefore: number | null;
  outcomeIndexAfter: number | null;
  observedOutcomeImpact: number | null;
  preliminary: boolean;
}

/** Observed outcome-index change from daily snapshots around a published action. */
export function computeObservedOutcomeImpact(
  snapshots: ScoreDailySnapshot[],
  publishedAt: string,
  windowDays = 14,
  now: Date = new Date()
): ObservedOutcomeImpact {
  const published = new Date(publishedAt);
  const preStart = addDays(published, -windowDays);
  const preEnd = published;
  const postStart = published;
  const postEnd = addDays(published, windowDays);
  const effectivePostEnd = now < postEnd ? now : postEnd;

  const outcomeIndexBefore = medianOutcomeIndexInRange(
    snapshots,
    formatDateYmd(preStart),
    formatDateYmd(addDays(preEnd, -1))
  );
  const outcomeIndexAfter = medianOutcomeIndexInRange(
    snapshots,
    formatDateYmd(postStart),
    formatDateYmd(addDays(effectivePostEnd, -1))
  );

  const observedOutcomeImpact =
    outcomeIndexBefore != null && outcomeIndexAfter != null
      ? outcomeIndexAfter - outcomeIndexBefore
      : null;

  return {
    outcomeIndexBefore,
    outcomeIndexAfter,
    observedOutcomeImpact,
    preliminary: now < postEnd,
  };
}

export interface ProjectionAccuracySample {
  stepNumber: number | null;
  projectedDriverImpact: number;
  observedDriverImpact: number;
  error: number;
  absError: number;
}

export interface OutcomeProjectionAccuracySample {
  stepNumber: number | null;
  projectedOutcomeImpact: number;
  observedOutcomeImpact: number;
  error: number;
  absError: number;
}

export interface RevenueProjectionAccuracySample {
  stepNumber: number | null;
  projectedRevenueGain: number;
  observedRevenueGain: number;
  error: number;
  absError: number;
}

export function buildProjectionAccuracySamples(
  rows: Array<{
    actionItemId: string;
    projectedDriverImpact: number | null;
    observedDriverImpact: number | null;
    preliminary?: boolean;
  }>
): ProjectionAccuracySample[] {
  const samples: ProjectionAccuracySample[] = [];

  for (const row of rows) {
    if (row.preliminary) continue;
    if (row.projectedDriverImpact == null || row.observedDriverImpact == null) continue;

    const match = row.actionItemId.match(/^gbp-step-(\d+)$/);
    const error = row.observedDriverImpact - row.projectedDriverImpact;

    samples.push({
      stepNumber: match ? Number(match[1]) : null,
      projectedDriverImpact: row.projectedDriverImpact,
      observedDriverImpact: row.observedDriverImpact,
      error,
      absError: Math.abs(error),
    });
  }

  return samples;
}

export function buildOutcomeProjectionAccuracySamples(
  rows: Array<{
    actionItemId: string;
    projectedOutcomeImpact: number | null;
    observedOutcomeImpact: number | null;
    preliminary?: boolean;
  }>
): OutcomeProjectionAccuracySample[] {
  const samples: OutcomeProjectionAccuracySample[] = [];

  for (const row of rows) {
    if (row.preliminary) continue;
    if (row.projectedOutcomeImpact == null || row.observedOutcomeImpact == null) continue;

    const match = row.actionItemId.match(/^gbp-step-(\d+)$/);
    const error = row.observedOutcomeImpact - row.projectedOutcomeImpact;

    samples.push({
      stepNumber: match ? Number(match[1]) : null,
      projectedOutcomeImpact: row.projectedOutcomeImpact,
      observedOutcomeImpact: row.observedOutcomeImpact,
      error,
      absError: Math.abs(error),
    });
  }

  return samples;
}

export function buildRevenueProjectionAccuracySamples(
  rows: Array<{
    actionItemId: string;
    projectedRevenueGain: number | null;
    estimatedRevenue: number | null;
    preliminary?: boolean;
  }>
): RevenueProjectionAccuracySample[] {
  const samples: RevenueProjectionAccuracySample[] = [];

  for (const row of rows) {
    if (row.preliminary) continue;
    if (row.projectedRevenueGain == null || row.estimatedRevenue == null) continue;
    if (row.projectedRevenueGain <= 0 || row.estimatedRevenue <= 0) continue;

    const match = row.actionItemId.match(/^gbp-step-(\d+)$/);
    const error = row.estimatedRevenue - row.projectedRevenueGain;

    samples.push({
      stepNumber: match ? Number(match[1]) : null,
      projectedRevenueGain: row.projectedRevenueGain,
      observedRevenueGain: row.estimatedRevenue,
      error,
      absError: Math.abs(error),
    });
  }

  return samples;
}

export function summarizeProjectionAccuracy(samples: ProjectionAccuracySample[]): {
  sampleSize: number;
  meanAbsError: number | null;
  meanError: number | null;
} {
  if (samples.length === 0) {
    return { sampleSize: 0, meanAbsError: null, meanError: null };
  }

  const meanError =
    samples.reduce((sum, row) => sum + row.error, 0) / samples.length;
  const meanAbsError =
    samples.reduce((sum, row) => sum + row.absError, 0) / samples.length;

  return {
    sampleSize: samples.length,
    meanAbsError: Math.round(meanAbsError * 10) / 10,
    meanError: Math.round(meanError * 10) / 10,
  };
}
