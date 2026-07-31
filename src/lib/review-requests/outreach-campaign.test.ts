import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_DAILY_SEND_CAP } from "@/lib/review-requests/bulk-config";

describe("outreach campaign pacing", () => {
  it("estimates spread days from daily cap", () => {
    const eligible = 250;
    const dailyCap = DEFAULT_DAILY_SEND_CAP;
    const estimatedDays = Math.max(1, Math.ceil(eligible / dailyCap));
    assert.equal(estimatedDays, 3);
  });
});
