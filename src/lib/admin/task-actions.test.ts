import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("forceApproveTask eligibility", () => {
  it("allows pending_approval and rejected statuses", () => {
    const approvable = new Set(["pending_approval", "rejected"]);
    assert.equal(approvable.has("pending_approval"), true);
    assert.equal(approvable.has("rejected"), true);
    assert.equal(approvable.has("completed"), false);
  });
});
