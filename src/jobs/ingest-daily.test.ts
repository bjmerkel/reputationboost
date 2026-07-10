import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IngestRunResult } from "@/audit/types/timeseries";
import { recordPlanReconcileMetrics } from "./ingest-daily";

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
