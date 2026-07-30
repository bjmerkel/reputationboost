import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldAutoSyncGuide } from "./sync";

describe("shouldAutoSyncGuide", () => {
  it("returns true when never synced", () => {
    assert.equal(shouldAutoSyncGuide(null), true);
    assert.equal(shouldAutoSyncGuide(undefined), true);
  });

  it("returns false when synced recently", () => {
    assert.equal(shouldAutoSyncGuide(new Date().toISOString()), false);
  });

  it("returns true when synced over a day ago", () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(shouldAutoSyncGuide(old), true);
  });
});
