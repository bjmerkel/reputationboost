import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldReuseMarketData } from "./refresh-policy";

describe("shouldReuseMarketData", () => {
  it("keeps manual profile refreshes off paid market APIs", () => {
    assert.equal(shouldReuseMarketData("manual", true), true);
  });

  it("allows onboarding to collect the initial market baseline", () => {
    assert.equal(shouldReuseMarketData("onboarding", true), false);
  });

  it("falls back to the full pipeline when no stored business exists", () => {
    assert.equal(shouldReuseMarketData("manual", false), false);
  });
});
