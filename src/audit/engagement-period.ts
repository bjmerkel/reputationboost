import type { FullAuditPayload } from "@/audit/types";
import type { DailyMetricPoint } from "@/audit/types/timeseries";

export interface EngagementMetricDelta {
  current: number;
  prior: number;
  change: number;
  changePercent: number | null;
}

export type EngagementPeriodSource = "ingest" | "audit_fallback" | "unavailable";

export interface EngagementPeriodSummary {
  periodDays: number;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
  source: EngagementPeriodSource;
  calls: EngagementMetricDelta;
  directions: EngagementMetricDelta;
  websiteClicks: EngagementMetricDelta;
}

export function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Rolling window bounds aligned with attribution summary (today − N days through today, UTC). */
export function rollingPeriodBounds(
  periodDays: number,
  referenceDate: Date = new Date()
): {
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
} {
  const end = new Date(referenceDate);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - periodDays);

  const priorEnd = new Date(start);
  priorEnd.setUTCDate(priorEnd.getUTCDate() - 1);

  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorStart.getUTCDate() - periodDays);

  return {
    startDate: formatDateYmd(start),
    endDate: formatDateYmd(end),
    priorStartDate: formatDateYmd(priorStart),
    priorEndDate: formatDateYmd(priorEnd),
  };
}

export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(`${start}T12:00:00.000Z`);
  const endDate = new Date(`${end}T12:00:00.000Z`);
  const monthDay: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startFmt = startDate.toLocaleDateString("en-US", monthDay);
  const endFmt = endDate.toLocaleDateString("en-US", {
    ...monthDay,
    year: start.slice(0, 4) !== end.slice(0, 4) ? "numeric" : undefined,
  });
  return `${startFmt} – ${endFmt}`;
}

export function formatEngagementPeriodLabel(summary: EngagementPeriodSummary): string {
  return formatDateRange(summary.startDate, summary.endDate);
}

function metricDelta(current: number, prior: number): EngagementMetricDelta {
  const change = current - prior;
  const changePercent =
    prior > 0 ? Math.round((change / prior) * 100) : current > 0 ? 100 : null;
  return { current, prior, change, changePercent };
}

function sumMetricInRange(
  points: DailyMetricPoint[],
  metric: DailyMetricPoint["metric"],
  startDate: string,
  endDate: string
): number {
  return points
    .filter((p) => p.metric === metric && p.date >= startDate && p.date <= endDate)
    .reduce((sum, p) => sum + p.value, 0);
}

function hasActionMetricsInRange(
  points: DailyMetricPoint[],
  startDate: string,
  endDate: string
): boolean {
  return points.some(
    (p) =>
      (p.metric === "calls" ||
        p.metric === "direction_requests" ||
        p.metric === "website_clicks") &&
      p.date >= startDate &&
      p.date <= endDate
  );
}

/**
 * Build rolling engagement totals from ingested daily metrics, with audit snapshot fallback
 * when nightly ingest has not populated action metrics yet.
 */
export function buildEngagementPeriodSummary(
  points: DailyMetricPoint[],
  periodDays = 30,
  options: { audit?: FullAuditPayload | null; referenceDate?: Date } = {}
): EngagementPeriodSummary {
  const referenceDate = options.referenceDate ?? new Date();
  const bounds = rollingPeriodBounds(periodDays, referenceDate);

  const currentFromPoints = {
    calls: sumMetricInRange(points, "calls", bounds.startDate, bounds.endDate),
    directions: sumMetricInRange(
      points,
      "direction_requests",
      bounds.startDate,
      bounds.endDate
    ),
    websiteClicks: sumMetricInRange(
      points,
      "website_clicks",
      bounds.startDate,
      bounds.endDate
    ),
  };

  const priorFromPoints = {
    calls: sumMetricInRange(points, "calls", bounds.priorStartDate, bounds.priorEndDate),
    directions: sumMetricInRange(
      points,
      "direction_requests",
      bounds.priorStartDate,
      bounds.priorEndDate
    ),
    websiteClicks: sumMetricInRange(
      points,
      "website_clicks",
      bounds.priorStartDate,
      bounds.priorEndDate
    ),
  };

  if (hasActionMetricsInRange(points, bounds.startDate, bounds.endDate)) {
    return {
      periodDays,
      ...bounds,
      source: "ingest",
      calls: metricDelta(currentFromPoints.calls, priorFromPoints.calls),
      directions: metricDelta(currentFromPoints.directions, priorFromPoints.directions),
      websiteClicks: metricDelta(
        currentFromPoints.websiteClicks,
        priorFromPoints.websiteClicks
      ),
    };
  }

  const audit = options.audit;
  const perf = audit?.gbp?.performance;
  if (audit && perf && perf.source !== "unavailable") {
    const report = audit.strategy?.monthlyReport;
    const auditEnd = audit.completedAt.slice(0, 10);
    const auditStart = new Date(`${auditEnd}T12:00:00.000Z`);
    auditStart.setUTCDate(auditStart.getUTCDate() - periodDays);

    return {
      periodDays,
      startDate: formatDateYmd(auditStart),
      endDate: auditEnd,
      priorStartDate: bounds.priorStartDate,
      priorEndDate: bounds.priorEndDate,
      source: "audit_fallback",
      calls: metricDelta(perf.calls, report?.engagement?.calls.prior ?? 0),
      directions: metricDelta(
        perf.directionRequests,
        report?.engagement?.directions.prior ?? 0
      ),
      websiteClicks: metricDelta(
        perf.websiteClicks,
        report?.engagement?.websiteClicks.prior ?? 0
      ),
    };
  }

  return {
    periodDays,
    ...bounds,
    source: "unavailable",
    calls: metricDelta(0, 0),
    directions: metricDelta(0, 0),
    websiteClicks: metricDelta(0, 0),
  };
}

export function buildRollingEngagementHeadline(summary: EngagementPeriodSummary): string | null {
  if (summary.calls.change > 0) {
    return `Calls up ${summary.calls.change} vs. the prior ${summary.periodDays} days — your visibility is converting.`;
  }
  if (summary.directions.change > 0) {
    return `Directions up ${summary.directions.change} vs. the prior ${summary.periodDays} days.`;
  }
  if (summary.websiteClicks.change > 0) {
    return `Website clicks up ${summary.websiteClicks.change} vs. the prior ${summary.periodDays} days.`;
  }
  return null;
}
