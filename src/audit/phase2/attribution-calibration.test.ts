import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionAttribution } from "@/audit/types/timeseries";
import {
  buildAttributionCalibration,
  calibratedStepImpact,
  projectionScaleForStep,
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
