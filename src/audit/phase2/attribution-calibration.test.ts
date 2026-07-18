import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionAttribution } from "@/audit/types/timeseries";
import {
  blendEngagementRates,
  buildAttributionCalibration,
  buildGapAttributionCalibration,
  calibratedRevenueGain,
  calibratedStepImpact,
  mergeCalibrations,
  negativeEvidencePenalty,
  projectionRevenueScaleForStep,
  projectionScaleForStep,
  rankDeltaForGap,
  rankDeltaForStep,
  resolveCalibrationConfidence,
} from "./attribution-calibration";

function attribution(
  overrides: Partial<ActionAttribution> & Pick<ActionAttribution, "actionItemId">
): ActionAttribution {
  return {
    id: "a1",
    executionTaskId: "t1",
    businessId: "b1",
    taskType: "gbp_description",
    title: "Description",
    publishedAt: "2026-06-01T00:00:00.000Z",
    windowDays: 14,
    primaryKeyword: "plumber dallas",
    rankBefore: 8,
    rankAfter: 6,
    rankDelta: -2,
    keywordsImproved: 1,
    callsDelta: 2,
    directionsDelta: null,
    websiteClicksDelta: null,
    impressionsDelta: null,
    estimatedRevenue: null,
    narrative: "",
    preliminary: false,
    computedAt: "2026-06-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildAttributionCalibration with projection data", () => {
  it("prefers observed driver impact when projection samples exist", () => {
    const calibration = buildAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-3",
        projectedDriverImpact: 8,
        observedDriverImpact: 4,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-3",
        projectedDriverImpact: 7,
        observedDriverImpact: 5,
      }),
    ]);

    assert.equal(calibration[3].projectionSampleSize, 2);
    assert.equal(calibration[3].medianObservedDriverImpact, 5);
    assert.ok(calibration[3].estimatedScoreImpact >= 4);
    assert.ok(calibration[3].estimatedScoreImpact <= 10);
  });

  it("falls back to rank-based impact without projection samples", () => {
    const calibration = buildAttributionCalibration([
      attribution({ actionItemId: "gbp-step-8", rankBefore: 10, rankAfter: 7 }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-8",
        rankBefore: 9,
        rankAfter: 8,
      }),
    ]);

    assert.equal(calibration[8].projectionSampleSize, 0);
    assert.ok(calibration[8].estimatedScoreImpact >= 1);
  });
});

describe("projectionScaleForStep", () => {
  it("scales down simulated impact when projections historically overshoot", () => {
    const calibration = buildAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-6",
        projectedDriverImpact: 10,
        observedDriverImpact: 4,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-6",
        projectedDriverImpact: 9,
        observedDriverImpact: 5,
      }),
      attribution({
        id: "a3",
        executionTaskId: "t3",
        actionItemId: "gbp-step-6",
        projectedDriverImpact: 8,
        observedDriverImpact: 4,
      }),
    ]);

    const scale = projectionScaleForStep(6, calibration);
    assert.ok(scale < 1);
    assert.ok(scale >= 0.5);

    const calibrated = calibratedStepImpact(6, 10, calibration);
    assert.ok(calibrated < 10);
  });
});

describe("resolveCalibrationConfidence", () => {
  it("maps sample sizes to confidence tiers", () => {
    assert.equal(resolveCalibrationConfidence(0), "default");
    assert.equal(resolveCalibrationConfidence(1), "low");
    assert.equal(resolveCalibrationConfidence(2), "medium");
    assert.equal(resolveCalibrationConfidence(5), "high");
  });
});

describe("buildGapAttributionCalibration", () => {
  it("derives per-keyword rank deltas from attributions", () => {
    const calibration = buildGapAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-8",
        primaryKeyword: "plumber dallas",
        rankBefore: 8,
        rankAfter: 5,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-10",
        primaryKeyword: "plumber dallas",
        rankBefore: 7,
        rankAfter: 4,
      }),
    ]);

    const gapCal = calibration["rank-outside-pack-plumber dallas"];
    assert.ok(gapCal);
    assert.equal(gapCal.sampleSize, 2);
    assert.equal(gapCal.medianRankDelta, 3);
    assert.equal(calibration["plumber dallas"].medianRankDelta, 3);
  });
});

describe("rankDeltaForGap", () => {
  it("uses calibrated median rank delta when available", () => {
    const gapCalibration = buildGapAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-8",
        primaryKeyword: "hvac repair",
        rankBefore: 9,
        rankAfter: 6,
      }),
    ]);

    assert.equal(
      rankDeltaForGap("rank-outside-pack-hvac repair", 10, gapCalibration),
      3
    );
  });

  it("falls back to default lift when no calibration exists", () => {
    assert.equal(rankDeltaForGap("rank-outside-pack-roofing", 12), 9);
  });
});

describe("blendEngagementRates", () => {
  it("pulls heuristic rates toward observed attribution when sample ≥ 2", () => {
    const calibration = buildAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-15",
        callsDelta: 1,
        directionsDelta: 2,
        websiteClicksDelta: 1,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-15",
        callsDelta: 1,
        directionsDelta: 2,
        websiteClicksDelta: 0,
      }),
    ]);

    const heuristic = { calls: 0.025, directions: 0.04, websiteClicks: 0.03 };
    const blended = blendEngagementRates(heuristic, 15, 500, calibration);
    assert.ok(blended.calls < heuristic.calls);
    assert.ok(blended.calls >= heuristic.calls * 0.5);
    assert.ok(blended.directions < heuristic.directions);
  });

  it("keeps heuristic rates when sample size is below 2", () => {
    const calibration = buildAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-8",
        callsDelta: 10,
        directionsDelta: 10,
      }),
    ]);
    const heuristic = { calls: 0.02, directions: 0.025, websiteClicks: 0 };
    assert.deepEqual(blendEngagementRates(heuristic, 8, 400, calibration), heuristic);
  });

  it("dampens heuristic rates when observed engagement is zero with sample ≥ 2", () => {
    const calibration = buildAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-8",
        callsDelta: 0,
        directionsDelta: 0,
        websiteClicksDelta: 0,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-8",
        callsDelta: 0,
        directionsDelta: 0,
        websiteClicksDelta: 0,
      }),
    ]);

    const heuristic = { calls: 0.02, directions: 0.025, websiteClicks: 0.015 };
    const blended = blendEngagementRates(heuristic, 8, 400, calibration);
    assert.ok(blended.calls < heuristic.calls);
    assert.ok(blended.calls >= heuristic.calls * 0.5);
    assert.ok(blended.directions < heuristic.directions);
  });
});

describe("rankDeltaForStep", () => {
  it("returns zero when calibrated median rank delta is non-positive", () => {
    const calibration = buildAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-8",
        rankBefore: 6,
        rankAfter: 8,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-8",
        rankBefore: 5,
        rankAfter: 6,
      }),
    ]);

    assert.equal(rankDeltaForStep(8, calibration), 0);
  });

  it("returns step-specific prior when uncalibrated", () => {
    assert.equal(rankDeltaForStep(1), 2);
    assert.equal(rankDeltaForStep(3), 1);
    assert.equal(rankDeltaForStep(8), 0);
    assert.equal(rankDeltaForStep(15), 0);
  });
});

describe("negativeEvidencePenalty", () => {
  it("demotes steps with zero observed engagement when sample ≥ 2", () => {
    const calibration = buildAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-8",
        callsDelta: 0,
        directionsDelta: 0,
        websiteClicksDelta: 0,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-8",
        callsDelta: 0,
        directionsDelta: 0,
        websiteClicksDelta: 0,
      }),
    ]);

    assert.equal(negativeEvidencePenalty(8, calibration), 0.3);
    assert.equal(negativeEvidencePenalty(15, calibration), 1);
  });
});

describe("mergeCalibrations", () => {
  it("preserves business zero engagement deltas instead of substituting global", () => {
    const merged = mergeCalibrations(
      {
        8: {
          sampleSize: 3,
          medianRankDelta: null,
          medianCallsDelta: 0,
          medianDirectionsDelta: 0,
          medianWebsiteClicksDelta: 0,
          estimatedScoreImpact: 2,
          projectionSampleSize: 0,
          medianProjectedDriverImpact: null,
          medianObservedDriverImpact: null,
          medianObservedOutcomeImpact: null,
          medianObservedRevenueGain: null,
          medianProjectedRevenueGain: null,
          revenueProjectionSampleSize: 0,
          revenueProjectionScale: 1,
          confidence: "medium",
        },
      },
      {
        8: {
          sampleSize: 20,
          medianRankDelta: 2,
          medianCallsDelta: 5,
          medianDirectionsDelta: 8,
          medianWebsiteClicksDelta: 3,
          estimatedScoreImpact: 4,
          projectionSampleSize: 0,
          medianProjectedDriverImpact: null,
          medianObservedDriverImpact: null,
          medianObservedOutcomeImpact: null,
          medianObservedRevenueGain: null,
          medianProjectedRevenueGain: null,
          revenueProjectionSampleSize: 0,
          revenueProjectionScale: 1,
          confidence: "high",
        },
      }
    );

    assert.equal(merged?.[8]?.medianCallsDelta, 0);
    assert.equal(merged?.[8]?.medianDirectionsDelta, 0);
    assert.equal(merged?.[8]?.medianWebsiteClicksDelta, 0);
  });
});

describe("revenue projection calibration", () => {
  it("scales projected revenue when historical projections overshoot", () => {
    const calibration = buildAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-4",
        projectedRevenueGain: 1000,
        estimatedRevenue: 400,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-4",
        projectedRevenueGain: 800,
        estimatedRevenue: 350,
      }),
    ]);

    const scale = projectionRevenueScaleForStep(4, calibration);
    assert.ok(scale < 1);
    assert.ok(scale >= 0.5);

    const calibrated = calibratedRevenueGain(
      500,
      [{ source: "plan", id: "gbp-step-4" }],
      calibration
    );
    assert.ok(calibrated < 500);
    assert.ok(calibrated > 0);
  });
});
