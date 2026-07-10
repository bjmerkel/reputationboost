import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FullAuditPayload } from "@/audit/types";
import type { DailyMetricPoint } from "@/audit/types/timeseries";
import {
  buildEngagementPeriodSummary,
  formatDateRange,
  formatPerformanceIngestLabel,
  rollingPeriodBounds,
} from "./engagement-period";

const REF = new Date("2026-07-10T15:00:00.000Z");

function dailyPointsForRange(
  start: string,
  end: string,
  callsPerDay: number
): DailyMetricPoint[] {
  const points: DailyMetricPoint[] = [];
  const cursor = new Date(`${start}T12:00:00.000Z`);
  const endDate = new Date(`${end}T12:00:00.000Z`);
  while (cursor <= endDate) {
    const date = cursor.toISOString().slice(0, 10);
    points.push({ date, metric: "calls", value: callsPerDay });
    points.push({ date, metric: "direction_requests", value: 0 });
    points.push({ date, metric: "website_clicks", value: 1 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

describe("rollingPeriodBounds", () => {
  it("uses a rolling window ending on the reference date", () => {
    const bounds = rollingPeriodBounds(30, REF);
    assert.equal(bounds.endDate, "2026-07-10");
    assert.equal(bounds.startDate, "2026-06-10");
    assert.equal(bounds.priorEndDate, "2026-06-09");
    assert.equal(bounds.priorStartDate, "2026-05-10");
  });
});

describe("buildEngagementPeriodSummary", () => {
  it("sums ingested daily metrics for current and prior windows", () => {
    const bounds = rollingPeriodBounds(30, REF);
    const current = dailyPointsForRange(bounds.startDate, bounds.endDate, 1);
    const prior = dailyPointsForRange(bounds.priorStartDate, bounds.priorEndDate, 2);
    const summary = buildEngagementPeriodSummary([...prior, ...current], 30, {
      referenceDate: REF,
    });

    assert.equal(summary.source, "ingest");
    assert.equal(summary.calls.current, 31);
    assert.equal(summary.calls.prior, 62);
    assert.equal(summary.calls.change, -31);
    assert.equal(summary.websiteClicks.current, 31);
  });

  it("falls back to audit GBP totals when ingest is empty", () => {
    const audit = {
      completedAt: "2026-07-01T12:00:00.000Z",
      gbp: {
        performance: {
          calls: 2,
          directionRequests: 0,
          websiteClicks: 3,
          source: "api",
        },
      },
      strategy: {
        monthlyReport: {
          engagement: {
            calls: { current: 2, prior: 1, change: 1, changePercent: 100 },
            directions: { current: 0, prior: 0, change: 0, changePercent: null },
            websiteClicks: { current: 3, prior: 2, change: 1, changePercent: 50 },
          },
        },
      },
    } as FullAuditPayload;

    const summary = buildEngagementPeriodSummary([], 30, {
      audit,
      referenceDate: REF,
    });

    assert.equal(summary.source, "audit_fallback");
    assert.equal(summary.calls.current, 2);
    assert.equal(summary.calls.prior, 1);
    assert.equal(summary.websiteClicks.current, 3);
    assert.equal(summary.endDate, "2026-07-01");
    assert.equal(summary.lastIngestedAt, "2026-07-01T12:00:00.000Z");
    assert.match(formatPerformanceIngestLabel(summary) ?? "", /Audit snapshot from/);
  });

  it("includes ingest metadata when provided", () => {
    const bounds = rollingPeriodBounds(30, REF);
    const points = dailyPointsForRange(bounds.startDate, bounds.endDate, 1);
    const summary = buildEngagementPeriodSummary(points, 30, {
      referenceDate: REF,
      ingestMeta: {
        latestDataDate: "2026-07-09",
        lastIngestedAt: "2026-07-10T04:15:00.000Z",
      },
    });

    assert.equal(summary.source, "ingest");
    assert.equal(summary.latestDataDate, "2026-07-09");
    assert.equal(summary.lastIngestedAt, "2026-07-10T04:15:00.000Z");
    assert.match(formatPerformanceIngestLabel(summary) ?? "", /Performance ingested/);
    assert.match(formatPerformanceIngestLabel(summary) ?? "", /data through Jul 9, 2026/);
  });

  it("falls back to audit when ingest rows exist but action totals are zero", () => {
    const bounds = rollingPeriodBounds(30, REF);
    const zeroIngest: DailyMetricPoint[] = [];
    const cursor = new Date(`${bounds.startDate}T12:00:00.000Z`);
    const endDate = new Date(`${bounds.endDate}T12:00:00.000Z`);
    while (cursor <= endDate) {
      const date = cursor.toISOString().slice(0, 10);
      zeroIngest.push({ date, metric: "calls", value: 0 });
      zeroIngest.push({ date, metric: "direction_requests", value: 0 });
      zeroIngest.push({ date, metric: "website_clicks", value: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const audit = {
      completedAt: "2026-07-01T12:00:00.000Z",
      gbp: {
        performance: {
          calls: 2,
          directionRequests: 0,
          websiteClicks: 3,
          source: "api",
        },
      },
      strategy: { monthlyReport: null },
    } as FullAuditPayload;

    const summary = buildEngagementPeriodSummary(zeroIngest, 30, {
      audit,
      referenceDate: REF,
      ingestMeta: {
        latestDataDate: bounds.endDate,
        lastIngestedAt: "2026-07-10T04:00:00.000Z",
      },
    });

    assert.equal(summary.source, "audit_fallback");
    assert.equal(summary.calls.current, 2);
    assert.equal(summary.websiteClicks.current, 3);
  });
});

describe("formatDateRange", () => {
  it("formats a compact month-day range", () => {
    assert.equal(formatDateRange("2026-06-10", "2026-07-10"), "Jun 10 – Jul 10");
  });
});
