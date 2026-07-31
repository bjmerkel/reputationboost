import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeUserHealthMetrics } from "./health";

describe("computeUserHealthMetrics", () => {
  it("flags high churn risk for inactive users with score decline", () => {
    const result = computeUserHealthMetrics({
      avgScore: 42,
      scoreDelta7d: -12,
      pendingTasks: 20,
      completedTasks: 0,
      failedTasks: 5,
      lastAuditAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      onboardedCount: 1,
      businessCount: 1,
      gbpConnectedCount: 0,
      grade: "at_risk",
    });

    assert.equal(result.churnRiskLevel, "high");
    assert.ok(result.churnRisk >= 60);
    assert.ok(result.healthIndex !== null && result.healthIndex < 50);
  });

  it("rewards healthy active users with a strong health index", () => {
    const result = computeUserHealthMetrics({
      avgScore: 78,
      scoreDelta7d: 6,
      pendingTasks: 2,
      completedTasks: 30,
      failedTasks: 0,
      lastAuditAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      onboardedCount: 1,
      businessCount: 1,
      gbpConnectedCount: 1,
      grade: "healthy",
    });

    assert.equal(result.churnRiskLevel, "low");
    assert.ok((result.healthIndex ?? 0) >= 70);
  });
});
