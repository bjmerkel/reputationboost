import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ATTRIBUTION_WINDOW_DAYS } from "@/lib/review-requests/attribution";

describe("ATTRIBUTION_WINDOW_DAYS", () => {
  it("uses a 14-day outreach attribution window", () => {
    assert.equal(ATTRIBUTION_WINDOW_DAYS, 14);
  });
});
