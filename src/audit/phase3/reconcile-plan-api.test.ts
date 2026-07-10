import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { computePlanReconcile } from "@/audit/phase3/reconcile-plan";

describe("plan reconcile API contract", () => {
  it("sets planReconciledAt on the audit strategy for UI/API consumers", () => {
    const audit = createTestAudit();
    const existing = [...(audit.execution?.tasks ?? [])];
    const result = computePlanReconcile(audit, existing, {
      now: "2026-07-10T01:30:00.000Z",
    });

    assert.equal(result.nextAudit.strategy.planReconciledAt, "2026-07-10T01:30:00.000Z");
  });
});
