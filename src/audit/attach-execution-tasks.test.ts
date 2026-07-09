import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachExecutionTasks } from "./attach-execution-tasks";
import { ensureStrategy } from "./ensure-strategy";
import { createTestAudit } from "./phase3/test-fixtures";

describe("attachExecutionTasks", () => {
  it("prevents ensureStrategy from regenerating execution when DB tasks exist", () => {
    const audit = createTestAudit();
    const storedTasks = audit.execution!.tasks.map((task) => ({
      ...task,
      actionItemId: task.actionItemId.startsWith("gbp-step-")
        ? task.actionItemId
        : "gbp-step-3",
    }));

    delete (audit as { execution?: unknown }).execution;

    const attached = attachExecutionTasks(audit, storedTasks);
    const ensured = ensureStrategy(attached);

    assert.equal(ensured.execution?.tasks.length, storedTasks.length);
    assert.equal(ensured.execution?.tasks[0]?.id, storedTasks[0]?.id);
  });
});
