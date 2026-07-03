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

export interface ProjectionAccuracySample {
  stepNumber: number | null;
  projectedDriverImpact: number;
  observedDriverImpact: number;
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
