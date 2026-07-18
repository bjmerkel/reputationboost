import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask } from "../types";
import { deriveStepStatus } from "./plan-step-status";

function stubTask(status: ExecutionTask["status"]): ExecutionTask {
  return {
    id: `task-${status}`,
    type: "review_response",
    title: "Respond",
    draftContent: "Thanks!",
    payload: {},
    status,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("deriveStepStatus", () => {
  it("marks step completed when every task is completed", () => {
    assert.equal(
      deriveStepStatus([stubTask("completed"), stubTask("completed")]),
      "completed"
    );
  });

  it("marks step skipped only when every task is rejected", () => {
    assert.equal(deriveStepStatus([stubTask("rejected")]), "skipped");
    assert.equal(
      deriveStepStatus([stubTask("rejected"), stubTask("rejected")]),
      "skipped"
    );
  });

  it("keeps step visible when one task is rejected and others remain", () => {
    assert.equal(
      deriveStepStatus([stubTask("rejected"), stubTask("pending_approval")]),
      "needs_approval"
    );
    assert.equal(
      deriveStepStatus([
        stubTask("rejected"),
        stubTask("pending_approval"),
        stubTask("completed"),
      ]),
      "needs_approval"
    );
  });

  it("marks step completed when remaining work is done and some tasks were rejected", () => {
    assert.equal(
      deriveStepStatus([stubTask("rejected"), stubTask("completed")]),
      "completed"
    );
  });

  it("returns needs_approval when an active task failed", () => {
    assert.equal(
      deriveStepStatus([stubTask("failed"), stubTask("completed")]),
      "needs_approval"
    );
  });
});
