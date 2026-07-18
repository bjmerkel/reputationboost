import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Plan, PlanStep } from "../types";
import { selectNextBestPlanSteps } from "./plan-next-actions";
import { resolveStepActionPriority } from "./gbp-plan-tasks";
import { createTestAudit } from "./test-fixtures";

function stubStep(overrides: Partial<PlanStep> & Pick<PlanStep, "stepNumber" | "title">): PlanStep {
  return {
    phaseId: "foundation",
    instruction: "Do the thing",
    context: {
      targetKeywords: ["emergency plumber dallas"],
      expectedEffect: "Improve pack presence",
      healthScoreImpact: 2,
      outcomeScoreImpact: 3,
      revenueImpact: null,
    },
    tasks: [],
    status: "needs_approval",
    ...overrides,
  };
}

describe("selectNextBestPlanSteps", () => {
  it("returns top unfinished steps by displayOrder and skips completed", () => {
    const plan: Plan = {
      title: "Plan",
      businessName: "Test",
      objective: "Win pack",
      targetKeywords: [],
      phases: [],
      progress: {
        totalSteps: 4,
        completedSteps: 1,
        needsApproval: 2,
        currentHealthScore: 50,
        projectedHealthScore: 70,
      },
      steps: [
        stubStep({
          stepNumber: 1,
          title: "Category",
          displayOrder: 3,
          status: "pending",
        }),
        stubStep({
          stepNumber: 8,
          title: "Posts",
          displayOrder: 0,
          status: "needs_approval",
          context: {
            targetKeywords: ["emergency plumber dallas"],
            primaryKeyword: "emergency plumber dallas",
            expectedEffect: "Post weekly",
            revenueImpact: 400,
            outcomeScoreImpact: 5,
            healthScoreImpact: 4,
          },
        }),
        stubStep({
          stepNumber: 3,
          title: "Description",
          displayOrder: 1,
          status: "completed",
        }),
        stubStep({
          stepNumber: 11,
          title: "Responses",
          displayOrder: 2,
          status: "pending",
        }),
      ],
    };

    const next = selectNextBestPlanSteps(plan, 3);
    assert.deepEqual(
      next.map((s) => s.stepNumber),
      [8, 11, 1]
    );
  });

  it("prefers higher leadsImpact when revenue is missing", () => {
    const plan: Plan = {
      title: "Plan",
      businessName: "Test",
      objective: "Win pack",
      targetKeywords: [],
      phases: [],
      progress: {
        totalSteps: 2,
        completedSteps: 0,
        needsApproval: 2,
        currentHealthScore: 50,
        projectedHealthScore: 70,
      },
      steps: [
        stubStep({
          stepNumber: 1,
          title: "Category",
          displayOrder: 0,
          status: "pending",
          context: {
            targetKeywords: ["emergency plumber dallas"],
            expectedEffect: "Fix category",
            revenueImpact: null,
            leadsImpact: 2,
            outcomeScoreImpact: 2,
            healthScoreImpact: 2,
          },
        }),
        stubStep({
          stepNumber: 8,
          title: "Posts",
          displayOrder: 5,
          status: "needs_approval",
          context: {
            targetKeywords: ["emergency plumber dallas"],
            expectedEffect: "Post weekly",
            revenueImpact: null,
            leadsImpact: 20,
            outcomeScoreImpact: 4,
            healthScoreImpact: 3,
          },
        }),
      ],
    };

    const next = selectNextBestPlanSteps(plan, 2);
    assert.deepEqual(
      next.map((s) => s.stepNumber),
      [8, 1]
    );
  });

  it("prefers higher revenueImpact over better displayOrder", () => {
    const plan: Plan = {
      title: "Plan",
      businessName: "Test",
      objective: "Win pack",
      targetKeywords: [],
      phases: [],
      progress: {
        totalSteps: 2,
        completedSteps: 0,
        needsApproval: 2,
        currentHealthScore: 50,
        projectedHealthScore: 70,
      },
      steps: [
        stubStep({
          stepNumber: 1,
          title: "Category",
          displayOrder: 0,
          status: "pending",
          context: {
            targetKeywords: ["emergency plumber dallas"],
            expectedEffect: "Fix category",
            revenueImpact: 50,
            outcomeScoreImpact: 2,
            healthScoreImpact: 2,
          },
        }),
        stubStep({
          stepNumber: 3,
          title: "Description",
          displayOrder: 5,
          status: "needs_approval",
          context: {
            targetKeywords: ["emergency plumber dallas"],
            primaryKeyword: "emergency plumber dallas",
            expectedEffect: "Rewrite description",
            revenueImpact: 500,
            outcomeScoreImpact: 4,
            healthScoreImpact: 3,
          },
        }),
      ],
    };

    const next = selectNextBestPlanSteps(plan, 2);
    assert.deepEqual(
      next.map((s) => s.stepNumber),
      [3, 1]
    );
  });

  it("overweights conversion steps when preferConversionSteps is set", () => {
    const plan: Plan = {
      title: "Plan",
      businessName: "Test",
      objective: "Convert views",
      targetKeywords: [],
      phases: [],
      progress: {
        totalSteps: 3,
        completedSteps: 0,
        needsApproval: 3,
        currentHealthScore: 50,
        projectedHealthScore: 70,
      },
      steps: [
        stubStep({
          stepNumber: 6,
          title: "Photos",
          displayOrder: 0,
          status: "pending",
          context: {
            targetKeywords: ["plumber near me"],
            expectedEffect: "Add photos",
            revenueImpact: 200,
            leadsImpact: 3,
            engagementImpact: 0,
            outcomeScoreImpact: 2,
            healthScoreImpact: 4,
          },
        }),
        stubStep({
          stepNumber: 15,
          title: "Place action links",
          displayOrder: 4,
          status: "needs_approval",
          context: {
            targetKeywords: ["plumber near me"],
            expectedEffect: "Add booking links",
            revenueImpact: 80,
            leadsImpact: 2,
            engagementImpact: 20,
            outcomeScoreImpact: 0,
            healthScoreImpact: 2,
          },
        }),
        stubStep({
          stepNumber: 8,
          title: "Posts",
          displayOrder: 5,
          status: "pending",
          context: {
            targetKeywords: ["plumber near me"],
            expectedEffect: "CTA posts",
            revenueImpact: 60,
            leadsImpact: 1,
            engagementImpact: 15,
            outcomeScoreImpact: 0,
            healthScoreImpact: 1,
          },
        }),
      ],
    };

    const withoutMode = selectNextBestPlanSteps(plan, 2);
    assert.deepEqual(
      withoutMode.map((s) => s.stepNumber),
      [15, 6]
    );

    const withMode = selectNextBestPlanSteps(plan, 2, { preferConversionSteps: true });
    assert.deepEqual(
      withMode.map((s) => s.stepNumber),
      [15, 8]
    );
  });
});

describe("resolveStepActionPriority", () => {
  it("uses displayOrder tiers instead of checklist step number", () => {
    const audit = createTestAudit();

    assert.equal(
      resolveStepActionPriority(audit, {
        stepNumber: 12,
        title: "Hours",
        instruction: "Fix hours",
        displayOrder: 0,
      }),
      "P0"
    );
    assert.equal(
      resolveStepActionPriority(audit, {
        stepNumber: 1,
        title: "Category",
        instruction: "Update category",
        displayOrder: 8,
      }),
      "P2"
    );
  });

  it("keeps unresponded negative review replies at P0", () => {
    const audit = createTestAudit();
    audit.reviews.unrespondedNegative = 2;
    audit.reviews.reviews = [];

    assert.equal(
      resolveStepActionPriority(audit, {
        stepNumber: 11,
        title: "Review Responses",
        instruction: "Respond",
        displayOrder: 9,
      }),
      "P0"
    );
  });
});
