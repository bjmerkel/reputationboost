import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AttributionCalibration } from "./attribution-calibration";
import {
  buildFieldAttributionCalibration,
  revenueScaleForField,
} from "./field-attribution-calibration";
import { scoreImpactForField } from "@/lib/google/gbp-field-score-impact";

const stepCalibration: AttributionCalibration = {
  3: {
    sampleSize: 4,
    medianRankDelta: 2,
    medianCallsDelta: 3,
    estimatedScoreImpact: 6,
    projectionSampleSize: 4,
    medianProjectedDriverImpact: 5,
    medianObservedDriverImpact: 4,
    medianObservedOutcomeImpact: 3,
    medianObservedRevenueGain: 800,
    medianProjectedRevenueGain: 1000,
    revenueProjectionSampleSize: 3,
    revenueProjectionScale: 0.8,
    confidence: "medium",
  },
};

describe("field-attribution-calibration", () => {
  it("builds field calibration from step calibration", () => {
    const fields = buildFieldAttributionCalibration(stepCalibration);
    const description = fields["profile.description"];

    assert.ok(description);
    assert.equal(description.sourceStepNumber, 3);
    assert.equal(description.confidence, "medium");
    assert.ok(description.calibratedMaxImpact > 0);
  });

  it("keeps default priors when no step calibration exists", () => {
    const fields = buildFieldAttributionCalibration();
    const description = fields["profile.description"];

    assert.equal(description.priorMaxImpact, 5);
    assert.equal(description.calibratedMaxImpact, 5);
    assert.equal(description.confidence, "default");
  });

  it("scales score impact when field calibration is provided", () => {
    const fields = buildFieldAttributionCalibration(stepCalibration);
    const prior = scoreImpactForField("profile.description", "missing");
    const calibrated = scoreImpactForField("profile.description", "missing", fields);

    assert.ok(calibrated.scoreImpact !== prior.scoreImpact || fields["profile.description"].scaleFactor !== 1);
    assert.equal(calibrated.calibrationConfidence, "medium");
  });

  it("returns revenue scale from linked step", () => {
    const fields = buildFieldAttributionCalibration(stepCalibration);
    const scale = revenueScaleForField("profile.description", fields, stepCalibration);
    assert.equal(scale, 0.8);
  });
});
