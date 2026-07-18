import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask, Plan, PlanStep } from "@/audit/types";
import {
  MANUAL_STEP_SYNC_LABEL,
  planGbpBannerMessage,
  planHasManualSteps,
  planStepHasPublishableTasks,
  reconcileFeedbackMessage,
  taskPrimaryActionLabel,
  taskUsesLocalCompletion,
} from "./plan-ux-copy";

function stubTask(type: ExecutionTask["type"], status: ExecutionTask["status"] = "pending_approval"): ExecutionTask {
  return {
    id: `task-${type}`,
    type,
    title: "Task",
    draftContent: "",
    payload: {},
    status,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function stubStep(overrides: Partial<PlanStep> & Pick<PlanStep, "stepNumber" | "title">): PlanStep {
  return {
    phaseId: "foundation",
    instruction: "Do the thing",
    context: {
      targetKeywords: ["plumber"],
      expectedEffect: "Improve",
      healthScoreImpact: 1,
      outcomeScoreImpact: 1,
      revenueImpact: null,
    },
    tasks: [],
    status: "pending",
    ...overrides,
  };
}

function stubPlan(steps: PlanStep[]): Plan {
  return {
    title: "Plan",
    businessName: "Test",
    objective: "Win",
    targetKeywords: [],
    phases: [],
    progress: {
      totalSteps: steps.length,
      completedSteps: 0,
      needsApproval: 0,
      currentHealthScore: 50,
      projectedHealthScore: 70,
    },
    steps,
  };
}

describe("taskPrimaryActionLabel", () => {
  it("uses Mark complete for checklist tasks", () => {
    assert.equal(taskPrimaryActionLabel(stubTask("gbp_checklist")), "Mark complete");
    assert.equal(taskUsesLocalCompletion(stubTask("gbp_checklist")), true);
  });

  it("uses Approve & publish for GBP field tasks", () => {
    assert.equal(taskPrimaryActionLabel(stubTask("gbp_description")), "Approve & publish");
  });
});

describe("planGbpBannerMessage", () => {
  it("returns null when GBP is disconnected", () => {
    assert.equal(planGbpBannerMessage(stubPlan([]), false), null);
  });

  it("mentions publish and manual sync when both apply", () => {
    const plan = stubPlan([
      stubStep({
        stepNumber: 3,
        title: "Description",
        tasks: [stubTask("gbp_description")],
      }),
      stubStep({
        stepNumber: 12,
        title: "Hours",
        tasks: [],
      }),
    ]);
    const message = planGbpBannerMessage(plan, true);
    assert.ok(message?.includes("approved and published"));
    assert.ok(message?.includes("refresh your plan"));
  });

  it("hides banner when plan has only completed steps", () => {
    const plan = stubPlan([
      stubStep({
        stepNumber: 1,
        title: "Category",
        status: "completed",
        tasks: [stubTask("gbp_primary_category", "completed")],
      }),
    ]);
    assert.equal(planGbpBannerMessage(plan, true), null);
  });
});

describe("planHasManualSteps", () => {
  it("detects unfinished steps without tasks", () => {
    const plan = stubPlan([
      stubStep({ stepNumber: 12, title: "Hours", tasks: [] }),
    ]);
    assert.equal(planHasManualSteps(plan), true);
    assert.equal(planStepHasPublishableTasks(plan.steps[0]), false);
  });
});

describe("reconcileFeedbackMessage", () => {
  it("reports completed tasks", () => {
    assert.match(reconcileFeedbackMessage({ completedTasks: 2, createdTasks: 0 }), /2 tasks marked complete/);
  });

  it("reports no changes when reconcile finds nothing", () => {
    assert.match(
      reconcileFeedbackMessage({ completedTasks: 0, createdTasks: 0 }),
      /no new changes found/
    );
  });
});

describe("MANUAL_STEP_SYNC_LABEL", () => {
  it("does not promise instant mark done", () => {
    assert.ok(!MANUAL_STEP_SYNC_LABEL.toLowerCase().includes("mark done"));
  });
});
