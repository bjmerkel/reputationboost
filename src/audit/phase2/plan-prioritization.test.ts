import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanStep } from "../types";
import { buildAttributionCalibration } from "./attribution-calibration";
import {
  planStepEffort,
  planStepPriorityScore,
  stepConfidenceMultiplier,
  stepExpectedValue,
} from "./plan-prioritization";

function stubStep(overrides: Partial<PlanStep> & Pick<PlanStep, "stepNumber" | "title">): PlanStep {
  return {
    phaseId: "foundation",
    instruction: "Do the thing",
    context: {
      targetKeywords: ["plumber dallas"],
      expectedEffect: "Improve",
      healthScoreImpact: 2,
      outcomeScoreImpact: 3,
      revenueImpact: null,
    },
    tasks: [],
    status: "needs_approval",
    ...overrides,
  };
}

describe("stepExpectedValue", () => {
  it("prefers revenue, then leads, then engagement", () => {
    assert.equal(
      stepExpectedValue(
        stubStep({
          stepNumber: 8,
          title: "Posts",
          context: {
            targetKeywords: ["plumber dallas"],
            expectedEffect: "Post",
            revenueImpact: 400,
          },
        })
      ),
      400
    );
    assert.equal(
      stepExpectedValue(
        stubStep({
          stepNumber: 10,
          title: "Reviews",
          context: {
            targetKeywords: ["plumber dallas"],
            expectedEffect: "Ask",
            leadsImpact: 4,
          },
        })
      ),
      200
    );
  });
});

describe("planStepPriorityScore", () => {
  it("ranks higher EV and lower effort ahead of slow low-impact work", () => {
    const placeActions = stubStep({
      stepNumber: 15,
      title: "Place actions",
      context: {
        targetKeywords: ["plumber dallas"],
        expectedEffect: "Links",
        revenueImpact: 120,
      },
    });
    const reviewRequests = stubStep({
      stepNumber: 10,
      title: "Reviews",
      context: {
        targetKeywords: ["plumber dallas"],
        expectedEffect: "Ask",
        revenueImpact: 110,
      },
    });

    assert.ok(
      planStepPriorityScore(placeActions) > planStepPriorityScore(reviewRequests)
    );
    assert.equal(planStepEffort(15), 2);
    assert.equal(planStepEffort(10), 7);
  });

  it("demotes steps with failed attribution evidence", () => {
    const calibration = buildAttributionCalibration([
      {
        id: "a1",
        executionTaskId: "t1",
        businessId: "b1",
        taskType: "google_post",
        actionItemId: "gbp-step-8",
        title: "Posts",
        publishedAt: "2026-06-01T00:00:00.000Z",
        windowDays: 14,
        primaryKeyword: "plumber dallas",
        rankBefore: 5,
        rankAfter: 6,
        rankDelta: 1,
        keywordsImproved: 0,
        callsDelta: 0,
        directionsDelta: 0,
        websiteClicksDelta: 0,
        impressionsDelta: 0,
        estimatedRevenue: null,
        narrative: "",
        preliminary: false,
        computedAt: "2026-06-15T00:00:00.000Z",
      },
      {
        id: "a2",
        executionTaskId: "t2",
        businessId: "b1",
        taskType: "google_post",
        actionItemId: "gbp-step-8",
        title: "Posts",
        publishedAt: "2026-06-02T00:00:00.000Z",
        windowDays: 14,
        primaryKeyword: "plumber dallas",
        rankBefore: 4,
        rankAfter: 5,
        rankDelta: 1,
        keywordsImproved: 0,
        callsDelta: 0,
        directionsDelta: 0,
        websiteClicksDelta: 0,
        impressionsDelta: 0,
        estimatedRevenue: null,
        narrative: "",
        preliminary: false,
        computedAt: "2026-06-16T00:00:00.000Z",
      },
    ]);

    const posts = stubStep({
      stepNumber: 8,
      title: "Posts",
      context: {
        targetKeywords: ["plumber dallas"],
        expectedEffect: "Post",
        revenueImpact: 200,
      },
    });
    const links = stubStep({
      stepNumber: 15,
      title: "Place actions",
      context: {
        targetKeywords: ["plumber dallas"],
        expectedEffect: "Links",
        revenueImpact: 180,
      },
    });

    assert.ok(planStepPriorityScore(posts, { calibration }) < planStepPriorityScore(links, { calibration }));
    assert.equal(stepConfidenceMultiplier(8, calibration), 0.85);
  });
});
