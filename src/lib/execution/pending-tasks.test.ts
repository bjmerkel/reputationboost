import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask } from "@/audit/types";
import {
  isRoutineTask,
  pendingBatchTasks,
  pendingRoutineTasks,
  sortPendingTasks,
} from "./pending-tasks";

function task(overrides: Partial<ExecutionTask> & { id: string }): ExecutionTask {
  return {
    auditId: "2026-07-03",
    actionItemId: "gbp-step-3",
    type: "gbp_description",
    title: "Description",
    description: "",
    priority: "P1",
    status: "pending_approval",
    draftContent: "draft",
    payload: { gbpStepNumber: 3 },
    requiresApproval: true,
    scheduledFor: null,
    completedAt: null,
    result: null,
    createdAt: "2026-07-03T00:00:00.000Z",
    planStepNumber: 3,
    ...overrides,
  };
}

describe("pending-tasks", () => {
  it("sorts by plan step then priority", () => {
    const sorted = sortPendingTasks([
      task({ id: "b", planStepNumber: 8, priority: "P1", actionItemId: "gbp-step-8" }),
      task({ id: "a", planStepNumber: 3, priority: "P0" }),
    ]);
    assert.equal(sorted[0].id, "a");
    assert.equal(sorted[1].id, "b");
  });

  it("identifies routine profile tasks", () => {
    assert.equal(isRoutineTask(task({ id: "1", type: "gbp_description" })), true);
    assert.equal(isRoutineTask(task({ id: "2", type: "review_response" })), false);
  });

  it("excludes photos without preview from batch", () => {
    const batchable = pendingBatchTasks([
      task({ id: "photo", type: "gbp_photo", payload: {} }),
      task({
        id: "photo-ready",
        type: "gbp_photo",
        payload: { previewDataUrl: "data:image/png;base64,abc" },
      }),
    ]);
    assert.equal(batchable.length, 1);
    assert.equal(batchable[0].id, "photo-ready");
  });

  it("filters routine batch tasks", () => {
    const routine = pendingRoutineTasks([
      task({ id: "desc", type: "gbp_description" }),
      task({ id: "post", type: "google_post" }),
    ]);
    assert.equal(routine.length, 1);
    assert.equal(routine[0].id, "desc");
  });
});
