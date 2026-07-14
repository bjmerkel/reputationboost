import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IngestRunResult } from "@/audit/types/timeseries";
import { normalizePerformancePoints, recordPlanReconcileMetrics } from "./ingest-daily";

function emptyResult(): IngestRunResult {
  return {
    jobName: "ingest-daily",
    businessesProcessed: 0,
    performanceRowsUpserted: 0,
    rankRowsUpserted: 0,
    scoreRowsUpserted: 0,
    calibrationStepsUpdated: 0,
    planTasksCreated: 0,
    planTasksAutoCompleted: 0,
    planReconcileBusinesses: 0,
    errors: [],
  };
}

describe("recordPlanReconcileMetrics", () => {
  it("accumulates created/completed counts across businesses", () => {
    const result = emptyResult();
    recordPlanReconcileMetrics(result, 2, 1);
    recordPlanReconcileMetrics(result, 0, 3);

    assert.equal(result.planTasksCreated, 2);
    assert.equal(result.planTasksAutoCompleted, 4);
    assert.equal(result.planReconcileBusinesses, 2);
  });

  it("initializes metrics when optional fields were omitted", () => {
    const result: IngestRunResult = {
      jobName: "ingest-daily",
      businessesProcessed: 0,
      performanceRowsUpserted: 0,
      rankRowsUpserted: 0,
      scoreRowsUpserted: 0,
      calibrationStepsUpdated: 0,
      errors: [],
    };

    recordPlanReconcileMetrics(result, 1, 0);
    assert.equal(result.planTasksCreated, 1);
    assert.equal(result.planTasksAutoCompleted, 0);
    assert.equal(result.planReconcileBusinesses, 1);
  });
});

describe("normalizePerformancePoints", () => {
  it("keeps delayed rows from the full lookback instead of only the target date", () => {
    const points = normalizePerformancePoints(
      [
        { date: "2026-07-10", metric: "calls", value: 1 },
        { date: "2026-07-10", metric: "impressions_search", value: 5 },
        { date: "2026-07-11", metric: "website_clicks", value: 2 },
      ],
      "2026-05-14",
      "2026-07-13"
    );

    assert.equal(points.some((point) => point.date === "2026-07-10"), true);
    assert.equal(points.some((point) => point.date === "2026-07-11"), true);
    assert.equal(points.some((point) => point.date === "2026-07-13"), false);
  });

  it("records zero actions for dates where Google returned only impressions", () => {
    const points = normalizePerformancePoints(
      [{ date: "2026-07-10", metric: "impressions_maps", value: 8 }],
      "2026-05-14",
      "2026-07-13"
    );

    assert.deepEqual(
      points.filter((point) => point.date === "2026-07-10"),
      [
        { date: "2026-07-10", metric: "calls", value: 0 },
        { date: "2026-07-10", metric: "direction_requests", value: 0 },
        { date: "2026-07-10", metric: "impressions_maps", value: 8 },
        { date: "2026-07-10", metric: "website_clicks", value: 0 },
      ]
    );
  });

  it("drops points outside the requested ingest window", () => {
    const points = normalizePerformancePoints(
      [
        { date: "2026-05-13", metric: "calls", value: 1 },
        { date: "2026-07-14", metric: "calls", value: 1 },
      ],
      "2026-05-14",
      "2026-07-13"
    );

    assert.deepEqual(points, []);
  });
});
