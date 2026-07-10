import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  auditMatchesTrackedKeywords,
  syncAuditToTrackedKeywords,
} from "./sync-tracked-keywords";

describe("syncAuditToTrackedKeywords", () => {
  it("returns the same audit when rankings already match", () => {
    const audit = createTestAudit();
    const keywords = audit.rankings.keywords.map((item) => item.keyword);
    const next = syncAuditToTrackedKeywords(audit, keywords);
    assert.equal(next, audit);
    assert.equal(auditMatchesTrackedKeywords(audit, keywords), true);
  });

  it("rewrites rankings to the tracked business keyword list", () => {
    const audit = createTestAudit();
    const kept = audit.rankings.keywords[0]!.keyword;
    const nextKeywords = [kept, "hvac repair wayne nj", "ac installation wayne"];
    const next = syncAuditToTrackedKeywords(audit, nextKeywords);

    assert.notEqual(next, audit);
    assert.deepEqual(
      next.rankings.keywords.map((item) => item.keyword),
      nextKeywords
    );
    assert.equal(auditMatchesTrackedKeywords(next, nextKeywords), true);
    assert.ok(next.keywordPortfolio);
  });
});
