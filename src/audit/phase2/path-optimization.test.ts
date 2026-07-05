import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BALANCED_WEIGHTS_WITH_ACV,
  BALANCED_WEIGHTS_WITHOUT_ACV,
  compositeMarginalScore,
  normalizeMarginalGain,
  resolveBlendWeights,
} from "./path-optimization";

describe("path optimization weights", () => {
  it("uses revenue blend when average customer value is set", () => {
    assert.deepEqual(resolveBlendWeights(350), BALANCED_WEIGHTS_WITH_ACV);
    assert.deepEqual(resolveBlendWeights(null), BALANCED_WEIGHTS_WITHOUT_ACV);
    assert.deepEqual(resolveBlendWeights(0), BALANCED_WEIGHTS_WITHOUT_ACV);
  });

  it("honors explicit blend overrides", () => {
    const custom = { driver: 0.2, outcome: 0.2, revenue: 0.6 };
    assert.deepEqual(resolveBlendWeights(350, custom), custom);
  });
});

describe("normalizeMarginalGain", () => {
  it("maps gains onto a 0-100 scale with a ceiling", () => {
    assert.equal(normalizeMarginalGain(0), 0);
    assert.equal(normalizeMarginalGain(-3), 0);
    assert.equal(normalizeMarginalGain(7.5, 15), 50);
    assert.equal(normalizeMarginalGain(30, 15), 100);
  });
});

describe("compositeMarginalScore", () => {
  it("blends normalized driver, outcome, and revenue marginals", () => {
    const impact = {
      driverGain: 15,
      outcomeGain: 0,
      visibilityGain: 0,
      revenueCaptureGain: 0,
      revenueGain: 250,
      overallGain: 10,
    };

    const score = compositeMarginalScore(impact, BALANCED_WEIGHTS_WITH_ACV, {
      revenue: 500,
    });

    assert.ok(score > 30);
    assert.ok(score < 60);
  });

  it("ignores revenue when weight is zero", () => {
    const withRevenue = compositeMarginalScore(
      {
        driverGain: 0,
        outcomeGain: 10,
        visibilityGain: 10,
        revenueCaptureGain: 5,
        revenueGain: 1000,
        overallGain: 5,
      },
      BALANCED_WEIGHTS_WITHOUT_ACV
    );
    const withoutRevenue = compositeMarginalScore(
      {
        driverGain: 0,
        outcomeGain: 10,
        visibilityGain: 10,
        revenueCaptureGain: 5,
        revenueGain: null,
        overallGain: 5,
      },
      BALANCED_WEIGHTS_WITHOUT_ACV
    );

    assert.equal(withRevenue, withoutRevenue);
  });
});
