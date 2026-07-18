import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanStep } from "../types";
import { formatPlanStepImpactLabel } from "./plan-impact-label";

function stubStep(overrides: Partial<PlanStep["context"]>): PlanStep {
  return {
    stepNumber: 8,
    phaseId: "content",
    title: "Posts",
    instruction: "Post weekly",
    context: {
      targetKeywords: [],
      expectedEffect: "More calls",
      revenueImpact: null,
      leadsImpact: null,
      ...overrides,
    },
    tasks: [],
    status: "pending",
  };
}

describe("formatPlanStepImpactLabel", () => {
  it("prefers revenue over leads and marks uncalibrated estimates as model", () => {
    assert.equal(
      formatPlanStepImpactLabel(
        stubStep({ revenueImpact: 400, leadsImpact: 12 }),
        "USD"
      ),
      "+$400/mo model est."
    );
    assert.equal(
      formatPlanStepImpactLabel(
        stubStep({
          revenueImpact: 400,
          leadsImpact: 12,
          projectionConfidence: "high",
        }),
        "USD"
      ),
      "+$400/mo est."
    );
  });

  it("falls back to leads/mo when revenue is missing", () => {
    assert.equal(
      formatPlanStepImpactLabel(stubStep({ leadsImpact: 12.4 }), "USD"),
      "+12 leads/mo model est."
    );
    assert.equal(
      formatPlanStepImpactLabel(stubStep({ leadsImpact: 0.4 }), "USD"),
      "+0.4 leads/mo model est."
    );
  });

  it("falls back to actions/mo before ranking points", () => {
    assert.equal(
      formatPlanStepImpactLabel(stubStep({ engagementImpact: 18 }), "USD"),
      "+18 actions/mo model est."
    );
  });

  it("falls back to ranking points when leads and engagement are missing", () => {
    assert.equal(
      formatPlanStepImpactLabel(stubStep({ outcomeScoreImpact: 5 }), "USD"),
      "+5 ranking pts"
    );
  });

  it("shows a qualitative signal for custom strategist steps", () => {
    const custom: PlanStep = {
      stepNumber: 18,
      phaseId: "ongoing",
      title: "Custom GBP tweak",
      instruction: "Do the thing.\n\nWhy this step: Competitors mention emergency response in posts.",
      context: {
        targetKeywords: ["emergency plumber dallas"],
        expectedEffect: "Reinforce urgency messaging on the profile.",
        selectionRationale: "Competitors mention emergency response in posts.",
        revenueImpact: null,
        leadsImpact: null,
        engagementImpact: null,
        projectionConfidence: "default",
      },
      tasks: [],
      status: "pending",
    };
    assert.equal(
      formatPlanStepImpactLabel(custom, "USD"),
      "Competitors mention emergency response in posts."
    );
  });
});
