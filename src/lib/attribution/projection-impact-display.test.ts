import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatOutcomeImpactLabel,
  formatRevenueImpactLabel,
} from "@/lib/attribution/projection-impact-display";

describe("formatOutcomeImpactLabel", () => {
  it("shows projected vs observed when both exist", () => {
    const label = formatOutcomeImpactLabel({
      projectedOutcomeImpact: 6,
      observedOutcomeImpact: 3,
      outcomeIndexBefore: 40,
      outcomeIndexAfter: 43,
    });
    assert.ok(label?.includes("40 → 43"));
    assert.ok(label?.includes("projected +6"));
  });
});

describe("formatRevenueImpactLabel", () => {
  it("shows revenue divergence from projection", () => {
    const label = formatRevenueImpactLabel({
      projectedRevenueGain: 1000,
      estimatedRevenue: 400,
      currency: "USD",
    });
    assert.ok(label?.includes("$400"));
    assert.ok(label?.includes("$1,000"));
  });
});
