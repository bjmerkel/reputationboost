import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isProximityOrDemandLimitedRankGap,
  stepClaimsRankImprovement,
  uncalibratedRankPriorForStep,
} from "./rank-priors";

describe("uncalibratedRankPriorForStep", () => {
  it("assigns stronger priors to category and service coverage steps", () => {
    assert.equal(uncalibratedRankPriorForStep(1), 2);
    assert.equal(uncalibratedRankPriorForStep(2), 2);
    assert.equal(uncalibratedRankPriorForStep(3), 1);
    assert.equal(uncalibratedRankPriorForStep(4), 1);
    assert.equal(uncalibratedRankPriorForStep(5), 1);
  });

  it("does not claim rank lift for media, posts, disputes, or conversion steps", () => {
    for (const stepNumber of [6, 7, 8, 9, 11, 12, 13, 14, 15]) {
      assert.equal(uncalibratedRankPriorForStep(stepNumber), 0);
    }
  });

  it("allows a conservative prominence prior for review acquisition", () => {
    assert.equal(uncalibratedRankPriorForStep(10), 1);
  });
});

describe("stepClaimsRankImprovement", () => {
  it("matches whether the step prior is non-zero", () => {
    assert.equal(stepClaimsRankImprovement(3), true);
    assert.equal(stepClaimsRankImprovement(8), false);
  });
});

describe("isProximityOrDemandLimitedRankGap", () => {
  it("flags rank-without-demand gaps as proximity/demand limited", () => {
    assert.equal(
      isProximityOrDemandLimitedRankGap("rank-without-demand-hvac repair"),
      true
    );
    assert.equal(
      isProximityOrDemandLimitedRankGap("rank-outside-pack-plumber"),
      false
    );
  });
});
