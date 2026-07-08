import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FullAuditPayload } from "@/audit/types";
import type { DailyMetricPoint, ScoreDailySnapshot } from "@/audit/types/timeseries";
import {
  performancePointsWithAuditFallback,
  scoreSeriesWithAuditFallback,
} from "./trend-fallbacks";

function minimalAudit(overrides: Partial<FullAuditPayload> = {}): FullAuditPayload {
  return {
    auditId: "a1",
    clientId: "biz-slug",
    completedAt: "2026-07-01T12:00:00.000Z",
    gbp: {
      performance: {
        calls: 12,
        directionRequests: 8,
        websiteClicks: 5,
        profileViews: 100,
        impressionsMaps: 60,
        impressionsSearch: 40,
        conversations: 0,
        bookings: 0,
        periodDays: 30,
        source: "api",
      },
    },
    strategy: {
      scores: {
        overall: 72,
        driverScore: 68,
        outcomeIndex: 75,
        visibility: 70,
        conversion: 68,
        revenueCapture: 80,
        grade: "needs_work",
      },
    },
    ...overrides,
  } as FullAuditPayload;
}

describe("performancePointsWithAuditFallback", () => {
  it("returns stored points when actions exist", () => {
    const points: DailyMetricPoint[] = [
      { date: "2026-07-05", metric: "calls", value: 3 },
    ];
    const result = performancePointsWithAuditFallback(points, minimalAudit());
    assert.equal(result, points);
  });

  it("falls back to audit totals when daily actions are empty", () => {
    const points: DailyMetricPoint[] = [
      { date: "2026-07-05", metric: "profile_views", value: 40 },
    ];
    const result = performancePointsWithAuditFallback(points, minimalAudit());
    assert.equal(result.length, 3);
    assert.equal(result.find((p) => p.metric === "calls")?.value, 12);
  });
});

describe("scoreSeriesWithAuditFallback", () => {
  it("adds audit score when missing from ingest series", () => {
    const series: ScoreDailySnapshot[] = [
      {
        businessId: "uuid",
        date: "2026-07-07",
        overall: 74,
        visibility: 70,
        conversion: 72,
        revenueCapture: 78,
        source: "ingest",
      },
    ];
    const result = scoreSeriesWithAuditFallback(series, minimalAudit());
    assert.equal(result.length, 2);
    assert.equal(result[0]?.date, "2026-07-01");
    assert.equal(result[0]?.overall, 72);
  });
});
