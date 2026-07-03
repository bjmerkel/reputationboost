import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  driverImpactTone,
  formatDriverImpactLabel,
  hasDriverImpactData,
} from "./driver-impact-display";

describe("formatDriverImpactLabel", () => {
  it("shows projected vs observed when both are present", () => {
    const label = formatDriverImpactLabel({
      projectedDriverImpact: 8,
      observedDriverImpact: 4,
    });
    assert.match(label ?? "", /\+4 pts/);
    assert.match(label ?? "", /projected \+8/);
  });

  it("shows score progression when before/after snapshots exist", () => {
    const label = formatDriverImpactLabel({
      projectedDriverImpact: 6,
      observedDriverImpact: 4,
      driverScoreBefore: 58,
      driverScoreAfter: 62,
    });
    assert.equal(label, "Reputation Boost Score 58 → 62 (projected +6)");
  });

  it("shows tracking state with projected value during preliminary window", () => {
    const label = formatDriverImpactLabel({
      preliminary: true,
      projectedDriverImpact: 5,
    });
    assert.match(label ?? "", /Tracking Reputation Boost Score/);
    assert.match(label ?? "", /projected \+5/);
  });

  it("returns null when no projection data exists", () => {
    assert.equal(formatDriverImpactLabel({}), null);
    assert.equal(hasDriverImpactData({}), false);
  });
});

describe("driverImpactTone", () => {
  it("flags large undershoots as warning", () => {
    assert.equal(
      driverImpactTone({ projectedDriverImpact: 8, observedDriverImpact: 2 }),
      "warning"
    );
  });

  it("marks positive observed gains within projection tolerance as positive", () => {
    assert.equal(
      driverImpactTone({ projectedDriverImpact: 6, observedDriverImpact: 5 }),
      "positive"
    );
  });
});
