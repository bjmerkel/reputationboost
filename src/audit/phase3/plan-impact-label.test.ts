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
  it("prefers revenue over leads", () => {
    assert.equal(
      formatPlanStepImpactLabel(
        stubStep({ revenueImpact: 400, leadsImpact: 12 }),
        "USD"
      ),
      "+$400/mo est."
    );
  });

  it("falls back to leads/mo when revenue is missing", () => {
    assert.equal(
      formatPlanStepImpactLabel(stubStep({ leadsImpact: 12.4 }), "USD"),
      "+12 leads/mo est."
    );
  });

  it("falls back to ranking points when leads are missing", () => {
    assert.equal(
      formatPlanStepImpactLabel(stubStep({ outcomeScoreImpact: 5 }), "USD"),
      "+5 ranking pts"
    );
  });
});
