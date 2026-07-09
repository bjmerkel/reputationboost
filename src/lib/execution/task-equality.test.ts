import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask } from "@/audit/types";
import { executionTasksEqual } from "./task-equality";

function task(overrides: Partial<ExecutionTask> = {}): ExecutionTask {
  return {
    id: "task-1",
    auditId: "2026-07-08",
    actionItemId: "gbp-step-3",
    type: "gbp_description",
    title: "Description",
    description: "",
    priority: "P1",
    status: "pending_approval",
    draftContent: "Draft",
    payload: {},
    requiresApproval: true,
    scheduledFor: null,
    completedAt: null,
    result: null,
    createdAt: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("executionTasksEqual", () => {
  it("treats identical task lists as equal", () => {
    const tasks = [task(), task({ id: "task-2" })];
    assert.equal(executionTasksEqual(tasks, [...tasks]), true);
  });

  it("detects status changes", () => {
    const before = [task()];
    const after = [task({ status: "completed", completedAt: "2026-07-09T00:00:00.000Z" })];
    assert.equal(executionTasksEqual(before, after), false);
  });
});
