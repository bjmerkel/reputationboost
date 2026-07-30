import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Plan } from "@/audit/types";
import {
  mergeProfileGuideIntoPlan,
  PROFILE_GUIDE_PLAN_STEP,
  shouldIncludeProfileGuidePlanStep,
} from "./plan-step";
import { EMPTY_PROFILE_GUIDE_READINESS } from "./readiness";
import { createTestAudit } from "@/audit/phase3/test-fixtures";

function stubPlan(steps: Plan["steps"]): Plan {
  return {
    title: "Plan",
    businessName: "Test",
    objective: "Grow reviews",
    targetKeywords: ["plumber"],
    phases: [],
    progress: {
      totalSteps: steps.length,
      completedSteps: 0,
      needsApproval: 0,
      currentHealthScore: 50,
      projectedHealthScore: 60,
    },
    steps,
  };
}

describe("profile guide plan step", () => {
  it("includes step 16 when review requests are in the plan", () => {
    const audit = createTestAudit();
    const plan = stubPlan([
      {
        stepNumber: 10,
        phaseId: "reputation",
        title: "Request more reviews",
        instruction: "Send SMS",
        context: { targetKeywords: [], expectedEffect: "More reviews" },
        tasks: [],
        status: "pending",
      },
    ]);

    assert.equal(shouldIncludeProfileGuidePlanStep(audit, plan), true);

    const merged = mergeProfileGuideIntoPlan(plan, audit, EMPTY_PROFILE_GUIDE_READINESS);
    assert.ok(merged.steps.some((step) => step.stepNumber === PROFILE_GUIDE_PLAN_STEP));
    assert.equal(
      merged.steps.find((step) => step.stepNumber === PROFILE_GUIDE_PLAN_STEP)?.status,
      "pending"
    );
  });

  it("removes step 16 when the guide is published with review link", () => {
    const audit = createTestAudit();
    const plan = stubPlan([
      {
        stepNumber: PROFILE_GUIDE_PLAN_STEP,
        phaseId: "reputation",
        title: "Publish your Profile Guide",
        instruction: "Publish",
        context: { targetKeywords: [], expectedEffect: "Guide live" },
        tasks: [],
        status: "pending",
      },
      {
        stepNumber: 10,
        phaseId: "reputation",
        title: "Request more reviews",
        instruction: "Send SMS",
        context: { targetKeywords: [], expectedEffect: "More reviews" },
        tasks: [],
        status: "pending",
      },
    ]);

    const merged = mergeProfileGuideIntoPlan(plan, audit, {
      exists: true,
      published: true,
      reviewLinkEnabled: true,
      views30d: 4,
      attributedReviews30d: 1,
    });

    assert.equal(
      merged.steps.some((step) => step.stepNumber === PROFILE_GUIDE_PLAN_STEP),
      false
    );
  });
});
