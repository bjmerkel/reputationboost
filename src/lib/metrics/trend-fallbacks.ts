import type { FullAuditPayload } from "@/audit/types";
import type { DailyMetricPoint, ScoreDailySnapshot } from "@/audit/types/timeseries";

const ACTION_METRICS = ["calls", "direction_requests", "website_clicks"] as const;

function sumActionMetrics(points: DailyMetricPoint[]): number {
  return points
    .filter((point) => ACTION_METRICS.includes(point.metric as (typeof ACTION_METRICS)[number]))
    .reduce((sum, point) => sum + point.value, 0);
}

/** Use audit-period GBP totals when stored daily action metrics are empty. */
export function performancePointsWithAuditFallback(
  points: DailyMetricPoint[],
  audit?: FullAuditPayload | null
): DailyMetricPoint[] {
  if (sumActionMetrics(points) > 0 || !audit) return points;

  const perf = audit.gbp.performance;
  if (!perf || perf.source === "unavailable") return points;

  const total = perf.calls + perf.directionRequests + perf.websiteClicks;
  if (total <= 0) return points;

  const date = audit.completedAt.slice(0, 10);
  return [
    { date, metric: "calls", value: perf.calls },
    { date, metric: "direction_requests", value: perf.directionRequests },
    { date, metric: "website_clicks", value: perf.websiteClicks },
  ];
}

/** Add the audit snapshot score when ingest history is sparse. */
export function scoreSeriesWithAuditFallback(
  series: ScoreDailySnapshot[],
  audit?: FullAuditPayload | null
): ScoreDailySnapshot[] {
  if (!audit?.strategy?.scores) return series;

  const auditDate = audit.completedAt.slice(0, 10);
  const scores = audit.strategy.scores;
  const hasAuditDate = series.some((point) => point.date === auditDate);
  if (hasAuditDate) return series;

  const auditPoint: ScoreDailySnapshot = {
    businessId: audit.clientId,
    date: auditDate,
    overall: scores.overall,
    driverScore: scores.driverScore,
    outcomeIndex: scores.outcomeIndex,
    visibility: scores.visibility,
    conversion: scores.conversion,
    revenueCapture: scores.revenueCapture,
    source: "audit",
  };

  return [...series, auditPoint].sort((a, b) => a.date.localeCompare(b.date));
}
