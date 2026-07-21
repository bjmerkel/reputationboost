import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateExperimentOutcome } from "./experiment-lifecycle";
import { deriveMarketKey } from "./market-key";
import { createTestAudit } from "@/audit/phase3/test-fixtures";

describe("experiment-lifecycle", () => {
  it("marks pack entry as won", () => {
    const outcome = evaluateExperimentOutcome({ rankBefore: 8, rankAfter: 2 });
    assert.equal(outcome.status, "won");
    assert.equal(outcome.improved, true);
  });

  it("marks unchanged rank as inconclusive", () => {
    const outcome = evaluateExperimentOutcome({ rankBefore: 9, rankAfter: 9 });
    assert.equal(outcome.status, "inconclusive");
  });

  it("marks worse visibility as lost", () => {
    const outcome = evaluateExperimentOutcome({ rankBefore: 9, rankAfter: null });
    assert.equal(outcome.status, "lost");
  });
});

describe("market-key", () => {
  it("builds a stable market key from category and address", () => {
    const audit = createTestAudit();
    const key = deriveMarketKey(audit);
    assert.ok(key.includes("|"));
    assert.ok(key.length > 3);
  });
});
