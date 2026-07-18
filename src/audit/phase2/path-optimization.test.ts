import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BALANCED_WEIGHTS_WITH_ACV,
  BALANCED_WEIGHTS_WITHOUT_ACV,
  compositeMarginalScore,
  effectiveOutcomeGain,
  engagementOutcomePoints,
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

describe("engagementOutcomePoints", () => {
  it("maps action lift onto conversion pts without inventing pack rank", () => {
    assert.equal(engagementOutcomePoints(0), 0);
    assert.equal(engagementOutcomePoints(20), 10);
    assert.equal(engagementOutcomePoints(100), 15);
    assert.equal(
      effectiveOutcomeGain({ outcomeGain: 4, engagementGain: 20 }),
      14
    );
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
      engagementGain: 0,
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
        engagementGain: 0,
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
        engagementGain: 0,
        overallGain: 5,
      },
      BALANCED_WEIGHTS_WITHOUT_ACV
    );

    assert.equal(withRevenue, withoutRevenue);
  });

  it("scores conversion engagement when pack-rank outcomeGain is 0", () => {
    const conversionOnly = compositeMarginalScore(
      {
        driverGain: 0,
        outcomeGain: 0,
        visibilityGain: 0,
        revenueCaptureGain: 0,
        revenueGain: null,
        engagementGain: 20,
        overallGain: 0,
      },
      BALANCED_WEIGHTS_WITHOUT_ACV
    );
    const zeroed = compositeMarginalScore(
      {
        driverGain: 0,
        outcomeGain: 0,
        visibilityGain: 0,
        revenueCaptureGain: 0,
        revenueGain: null,
        engagementGain: 0,
        overallGain: 0,
      },
      BALANCED_WEIGHTS_WITHOUT_ACV
    );

    assert.ok(conversionOnly > 0);
    assert.equal(zeroed, 0);
    assert.ok(conversionOnly > zeroed);
  });
});
