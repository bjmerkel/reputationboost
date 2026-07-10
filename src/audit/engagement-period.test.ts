import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FullAuditPayload } from "@/audit/types";
import type { DailyMetricPoint } from "@/audit/types/timeseries";
import {
  buildEngagementPeriodSummary,
  formatDateRange,
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
  });
});

describe("formatDateRange", () => {
  it("formats a compact month-day range", () => {
    assert.equal(formatDateRange("2026-06-10", "2026-07-10"), "Jun 10 – Jul 10");
  });
});
