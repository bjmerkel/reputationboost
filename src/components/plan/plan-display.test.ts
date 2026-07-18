import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlanStep } from "@/audit/types";
import {
  filterVisiblePlanSteps,
  formatStepAttributionTrackingLabel,
  partitionVisiblePlanSteps,
  planApprovalBadgeCopy,
  planProgressPercent,
  resolvePlanProjectionDisplay,
} from "./plan-display";
import type { ActionAttribution } from "@/audit/types/timeseries";

function stubStep(
  overrides: Partial<PlanStep> & Pick<PlanStep, "stepNumber" | "title">
): PlanStep {
  return {
    phaseId: "foundation",
    instruction: "Do the thing",
    context: {
      targetKeywords: ["plumber"],
      expectedEffect: "Improve",
    },
    tasks: [],
    status: "pending",
    ...overrides,
  };
}

describe("filterVisiblePlanSteps", () => {
  it("removes skipped steps but keeps steps with rejected sibling tasks", () => {
    const steps = [
      stubStep({ stepNumber: 11, title: "Reviews", status: "needs_approval" }),
      stubStep({ stepNumber: 12, title: "Hours", status: "skipped" }),
    ];
    const visible = filterVisiblePlanSteps(steps);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].stepNumber, 11);
  });

  it("sorts open steps before completed steps", () => {
    const steps = [
      stubStep({ stepNumber: 3, title: "Description", status: "completed" }),
      stubStep({ stepNumber: 4, title: "Services", status: "needs_approval" }),
    ];
    const visible = filterVisiblePlanSteps(steps);
    assert.equal(visible[0].stepNumber, 4);
    assert.equal(visible[1].stepNumber, 3);
  });
});

describe("partitionVisiblePlanSteps", () => {
  it("flags phases that still need approval", () => {
    const { phaseNeedsApproval, open, completed } = partitionVisiblePlanSteps([
      stubStep({ stepNumber: 8, title: "Posts", status: "needs_approval" }),
      stubStep({ stepNumber: 1, title: "Category", status: "completed" }),
    ]);
    assert.equal(phaseNeedsApproval, true);
    assert.equal(open.length, 1);
    assert.equal(completed.length, 1);
  });
});

describe("planProgressPercent", () => {
  it("rounds completion percentage", () => {
    assert.equal(planProgressPercent(1, 3), 33);
    assert.equal(planProgressPercent(0, 0), 0);
  });
});

describe("resolvePlanProjectionDisplay", () => {
  it("prefers revenue over leads", () => {
    const display = resolvePlanProjectionDisplay({
      estimatedMonthlyRevenue: 1000,
      projectedMonthlyRevenue: 1500,
      estimatedMonthlyLeads: 10,
      projectedMonthlyLeads: 15,
    });
    assert.equal(display.showRevenue, true);
    assert.equal(display.showLeads, false);
  });

  it("shows leads when revenue is unavailable", () => {
    const display = resolvePlanProjectionDisplay({
      estimatedMonthlyLeads: 4,
      projectedMonthlyLeads: 8,
    });
    assert.equal(display.showLeads, true);
  });

  it("prefers actions over leads when revenue is unavailable", () => {
    const display = resolvePlanProjectionDisplay({
      estimatedMonthlyActions: 2,
      projectedMonthlyActions: 12,
      estimatedMonthlyLeads: 4,
      projectedMonthlyLeads: 8,
    });
    assert.equal(display.showActions, true);
    assert.equal(display.showLeads, false);
  });
});

describe("plan UI copy helpers", () => {
  it("formats approval badges", () => {
    assert.equal(planApprovalBadgeCopy(1, false), "1 needs your approval");
    assert.equal(planApprovalBadgeCopy(2, true), "2 need approval → Review");
  });

  it("shows measuring copy on completed steps with preliminary attribution", () => {
    const step = stubStep({ stepNumber: 11, title: "Reviews", status: "completed" });
    step.tasks = [
      {
        id: "task-1",
        type: "review_response",
        title: "Reply",
        draftContent: "",
        payload: {},
        status: "completed",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ];
    const attribution: ActionAttribution = {
      id: "attr-1",
      executionTaskId: "task-1",
      businessId: "biz-1",
      taskType: "review_response",
      actionItemId: "action-1",
      title: "Reply",
      publishedAt: "2026-07-01T00:00:00.000Z",
      windowDays: 7,
      primaryKeyword: null,
      rankBefore: null,
      rankAfter: null,
      rankDelta: null,
      keywordsImproved: 0,
      callsDelta: null,
      directionsDelta: null,
      websiteClicksDelta: null,
      impressionsDelta: null,
      estimatedRevenue: null,
      narrative: "",
      preliminary: true,
      computedAt: "2026-07-02T00:00:00.000Z",
    };

    const label = formatStepAttributionTrackingLabel(step, { "task-1": attribution });
    assert.match(label ?? "", /Measuring · \d+ days left/);
  });
});
