import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calibrationConfidenceLabel,
  formatPathStepImpact,
  optimizationModeHint,
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
