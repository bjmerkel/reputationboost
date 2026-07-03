import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { resolveDisplayCategory } from "./display-category";

describe("resolveDisplayCategory", () => {
  it("prefers industry from settings over audit GBP category", () => {
    const audit = createTestAudit();
    assert.equal(
      resolveDisplayCategory(audit, "Car stereo store"),
      "Car stereo store"
    );
  });

  it("falls back to audit category when industry is missing", () => {
    const audit = createTestAudit();
    assert.equal(resolveDisplayCategory(audit, ""), audit.gbp.identity.primaryCategory);
    assert.equal(resolveDisplayCategory(audit), audit.gbp.identity.primaryCategory);
  });
});
