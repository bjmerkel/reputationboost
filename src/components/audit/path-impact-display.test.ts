import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calibrationConfidenceLabel,
  formatPathStepImpact,
  isUncalibratedProjection,
  optimizationModeHint,
  projectionEstimatePrefix,
  revenueProjectionFormulaHint,
} from "@/components/audit/path-impact-display";

describe("formatPathStepImpact", () => {
  const baseStep = {
    id: "gbp-step-3",
    title: "Description",
    scoreImpact: 5,
    source: "plan" as const,
    order: 0,
    driverImpact: 5,
    outcomeImpact: 3,
    revenueImpact: 420,
    revenueImpactLabel: "+$420/mo est.",
  };

  it("prefers revenue label in revenue mode", () => {
    assert.equal(formatPathStepImpact(baseStep, "revenue"), "+$420/mo est.");
  });

  it("shows outcome points in outcome mode", () => {
    assert.equal(formatPathStepImpact(baseStep, "outcome"), "+3 outcome");
  });

  it("falls back to driver points in driver mode", () => {
    assert.equal(formatPathStepImpact(baseStep, "driver"), "+5 pts");
  });

  it("shows engagement actions when ranking outcome is flat", () => {
    assert.equal(
      formatPathStepImpact(
        {
          ...baseStep,
          id: "gbp-step-8",
          outcomeImpact: 0,
          revenueImpact: null,
          revenueImpactLabel: null,
          engagementImpact: 23,
        },
        "outcome"
      ),
      "+23 actions/mo"
    );
  });
});

describe("optimizationModeHint", () => {
  it("describes revenue mode", () => {
    assert.ok(optimizationModeHint("revenue")?.includes("revenue"));
  });
});

describe("calibrationConfidenceLabel", () => {
  it("returns null for default confidence", () => {
    assert.equal(calibrationConfidenceLabel("default"), null);
  });

  it("labels high confidence", () => {
    assert.ok(calibrationConfidenceLabel("high")?.includes("high confidence"));
  });
});

describe("projection estimate labeling", () => {
  it("treats default and low confidence as uncalibrated", () => {
    assert.equal(isUncalibratedProjection("default"), true);
    assert.equal(isUncalibratedProjection("low"), true);
    assert.equal(isUncalibratedProjection("medium"), false);
    assert.equal(isUncalibratedProjection("high"), false);
  });

  it("uses Low-confidence model est. prefix when no calibration exists", () => {
    assert.equal(projectionEstimatePrefix("default"), "Low-confidence model est.");
    assert.equal(projectionEstimatePrefix(undefined), "Low-confidence model est.");
    assert.equal(projectionEstimatePrefix("low"), "Model est.");
    assert.equal(projectionEstimatePrefix("medium"), "Est.");
    assert.equal(projectionEstimatePrefix("high"), "Est.");
  });

  it("documents the revenue projection formula", () => {
    assert.ok(revenueProjectionFormulaHint().includes("impressions"));
    assert.ok(revenueProjectionFormulaHint().includes("calibration"));
  });
});
