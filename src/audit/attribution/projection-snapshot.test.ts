import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  enrichTaskWithProjectionSnapshot,
  resolveProjectionsFromTask,
  snapshotTaskProjections,
} from "@/audit/attribution/projection-snapshot";
import type { ExecutionTask } from "@/audit/types";

function task(overrides: Partial<ExecutionTask> = {}): ExecutionTask {
  return {
    id: "t1",
    auditId: "a1",
    actionItemId: "gbp-step-3",
    type: "gbp_description",
    title: "Description",
    description: "",
    priority: "P1",
    status: "completed",
    draftContent: "draft",
    payload: { gbpStepNumber: 3 },
    requiresApproval: true,
    scheduledFor: null,
    completedAt: "2026-06-15T00:00:00.000Z",
    result: "ok",
    createdAt: "2026-06-01T00:00:00.000Z",
    planStepNumber: 3,
    planPhaseId: "foundation",
    ...overrides,
  };
}

describe("snapshotTaskProjections", () => {
  it("captures driver, outcome, and revenue projections for plan steps", () => {
    const audit = createTestAudit();
    const snapshot = snapshotTaskProjections(audit, task(), {
      avgCustomerValue: 350,
    });

    assert.ok(snapshot);
    assert.ok((snapshot!.projectedDriverImpact ?? 0) > 0);
    assert.ok((snapshot!.projectedOutcomeImpact ?? 0) >= 0);
    assert.ok(snapshot!.snapshotAt.length > 0);
  });

  it("returns null for non-plan tasks", () => {
    const audit = createTestAudit();
    const snapshot = snapshotTaskProjections(
      audit,
      task({ actionItemId: "review-1", planStepNumber: null, payload: {} })
    );
    assert.equal(snapshot, null);
  });
});

describe("enrichTaskWithProjectionSnapshot", () => {
  it("writes snapshot fields into task payload", () => {
    const enriched = enrichTaskWithProjectionSnapshot(task(), {
      projectedDriverImpact: 6,
      projectedOutcomeImpact: 4,
      projectedRevenueGain: 500,
      snapshotAt: "2026-06-15T00:00:00.000Z",
    });

    assert.equal(enriched.payload.projectedDriverImpact, 6);
    assert.equal(enriched.payload.projectedOutcomeImpact, 4);
    assert.equal(enriched.payload.projectedRevenueGain, 500);
    assert.equal(enriched.payload.projectionsSnapshotAt, "2026-06-15T00:00:00.000Z");
  });
});

describe("resolveProjectionsFromTask", () => {
  it("reads legacy payload keys", () => {
    const resolved = resolveProjectionsFromTask(
      task({
        payload: {
          healthScoreImpact: 5,
          outcomeScoreImpact: 3,
          revenueImpact: 250,
        },
      })
    );

    assert.equal(resolved.projectedDriverImpact, 5);
    assert.equal(resolved.projectedOutcomeImpact, 3);
    assert.equal(resolved.projectedRevenueGain, 250);
  });
});
