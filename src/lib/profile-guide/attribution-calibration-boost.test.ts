import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AttributionCalibration } from "@/audit/phase2/attribution-calibration";
import { applyProfileGuideReviewCalibrationBoost } from "./attribution-calibration-boost";
import type { ProfileGuideReadiness } from "./readiness";

const readinessWithAttributions = (count: number): ProfileGuideReadiness => ({
  exists: true,
  published: true,
  reviewLinkEnabled: true,
  views30d: 20,
  attributedReviews30d: count,
});

describe("applyProfileGuideReviewCalibrationBoost", () => {
  it("returns calibration unchanged when attributed reviews are below threshold", () => {
    const calibration: AttributionCalibration = {
      10: {
        sampleSize: 1,
        medianRankDelta: null,
        medianCallsDelta: 0,
        medianDirectionsDelta: 0,
        medianWebsiteClicksDelta: 0,
        estimatedScoreImpact: 1,
        projectionSampleSize: 0,
        medianProjectedDriverImpact: null,
        medianObservedDriverImpact: null,
        medianObservedOutcomeImpact: 1,
        medianObservedRevenueGain: null,
        medianProjectedRevenueGain: null,
        revenueProjectionSampleSize: 0,
        revenueProjectionScale: 1,
        confidence: "low",
      },
    };

    const result = applyProfileGuideReviewCalibrationBoost(
      calibration,
      readinessWithAttributions(1)
    );
    assert.deepEqual(result, calibration);
  });

  it("boosts step 10 calibration when two or more reviews are attributed", () => {
    const calibration: AttributionCalibration = {
      10: {
        sampleSize: 1,
        medianRankDelta: null,
        medianCallsDelta: 0,
        medianDirectionsDelta: 0,
        medianWebsiteClicksDelta: 0,
        estimatedScoreImpact: 1,
        projectionSampleSize: 0,
        medianProjectedDriverImpact: null,
        medianObservedDriverImpact: null,
        medianObservedOutcomeImpact: 1,
        medianObservedRevenueGain: null,
        medianProjectedRevenueGain: null,
        revenueProjectionSampleSize: 0,
        revenueProjectionScale: 1,
        confidence: "low",
      },
    };

    const result = applyProfileGuideReviewCalibrationBoost(
      calibration,
      readinessWithAttributions(2)
    );
    assert.ok(result);
    assert.equal(result![10]?.sampleSize, 2);
    assert.equal(result![10]?.estimatedScoreImpact, 3);
    assert.equal(result![10]?.medianObservedOutcomeImpact, 3);
    assert.equal(result![10]?.confidence, "medium");
  });

  it("creates step 10 calibration when missing", () => {
    const result = applyProfileGuideReviewCalibrationBoost(
      {},
      readinessWithAttributions(3)
    );
    assert.ok(result?.[10]);
    assert.equal(result![10]?.sampleSize, 3);
    assert.equal(result![10]?.confidence, "medium");
  });
});
