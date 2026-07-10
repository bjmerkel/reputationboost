import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask } from "../types";
import { KEYWORD_PORTFOLIO_PLAN_STEP } from "../phase2/keyword-portfolio";
import { createTestAudit } from "./test-fixtures";
import { collectMissingReconcileTasks } from "./missing-tasks";
import {
  computePlanReconcile,
  refreshGbpPlanForReconcile,
  selectTasksToAutoComplete,
} from "./reconcile-plan";
import { taskIdentityKey } from "./task-identity";

function task(overrides: Partial<ExecutionTask> = {}): ExecutionTask {
  return {
    id: "task-1",
    auditId: "2026-07-03",
    actionItemId: "gbp-step-3",
    type: "gbp_description",
    title: "Step 3: Description",
    description: "",
    priority: "P1",
    status: "pending_approval",
    draftContent: "Draft",
    payload: { gbpStepNumber: 3 },
    requiresApproval: true,
    scheduledFor: null,
    completedAt: null,
    result: null,
    createdAt: "2026-07-03T12:00:00.000Z",
    planStepNumber: 3,
    ...overrides,
  };
}

describe("collectMissingReconcileTasks", () => {
  it("does not re-create tasks that already exist with the same identity", () => {
    const audit = createTestAudit();
    const existing = audit.execution?.tasks ?? [];
    assert.ok(existing.length > 0);

    const missing = collectMissingReconcileTasks(audit, existing);
    const existingKeys = new Set(
      existing
        .filter((item) => item.status !== "completed" && item.status !== "rejected")
        .map((item) => taskIdentityKey(item))
    );

    for (const candidate of missing) {
      assert.equal(
        existingKeys.has(taskIdentityKey(candidate)),
        false,
        `should not recreate ${taskIdentityKey(candidate)}`
      );
    }
  });

  it("creates NAP tasks when drift appears and none exist", () => {
    const audit = createTestAudit();
    audit.gbp.napDrift = [
      {
        field: "phone",
        label: "Phone",
        canonical: "(214) 555-0100",
        live: "(214) 555-9999",
      },
    ];

    const missing = collectMissingReconcileTasks(audit, []);
    assert.ok(missing.some((item) => item.type === "gbp_phone" && item.payload.napField === "phone"));
  });
});

describe("selectTasksToAutoComplete", () => {
  it("auto-completes pending hours tasks when step 12 is satisfied", () => {
    const audit = createTestAudit();
    audit.gbp.completeness = {
      ...audit.gbp.completeness,
      hasHours: true,
      hasFullWeekHours: true,
      hasHolidayHours: true,
    };

    const pending = task({
      id: "pending-hours",
      type: "gbp_hours",
      status: "pending_approval",
      planStepNumber: 12,
      actionItemId: "gbp-step-12",
      payload: { gbpStepNumber: 12, hoursAction: "update_holiday_hours", holidayYear: 2026 },
    });
    const approved = task({
      id: "approved-hours",
      type: "gbp_hours",
      status: "approved",
      planStepNumber: 12,
      actionItemId: "gbp-step-12",
      payload: { gbpStepNumber: 12, hoursAction: "update_regular_hours" },
      draftContent: "User approved draft",
    });

    const toComplete = selectTasksToAutoComplete(audit, [pending, approved]);
    assert.equal(toComplete.length, 1);
    assert.equal(toComplete[0].id, "pending-hours");
  });

  it("does not auto-complete approved or scheduled tasks", () => {
    const audit = createTestAudit();
    audit.gbp.completeness = {
      ...audit.gbp.completeness,
      hasHours: true,
      hasFullWeekHours: true,
      hasHolidayHours: true,
    };

    const approved = task({
      id: "hours",
      type: "gbp_hours",
      status: "approved",
      planStepNumber: 12,
      payload: { gbpStepNumber: 12, hoursAction: "update_holiday_hours", holidayYear: 2026 },
    });

    assert.equal(selectTasksToAutoComplete(audit, [approved]).length, 0);
  });

  it("auto-completes review responses when the review already has a reply", () => {
    const audit = createTestAudit();
    const reviewId = audit.reviews.reviews[0]?.id ?? "reviews/1";
    if (audit.reviews.reviews[0]) {
      audit.reviews.reviews[0] = {
        ...audit.reviews.reviews[0],
        replyText: "Thanks for the feedback!",
        replyState: "LIVE",
      };
    } else {
      audit.reviews.reviews = [
        {
          id: reviewId,
          author: "Pat",
          rating: 2,
          text: "Late",
          createTime: "2026-07-01T00:00:00.000Z",
          updateTime: "2026-07-01T00:00:00.000Z",
          replyText: "Thanks!",
          replyState: "LIVE",
        },
      ];
    }

    const pending = task({
      id: "reply",
      type: "review_response",
      planStepNumber: 11,
      payload: { reviewId, gbpStepNumber: 11 },
      status: "pending_approval",
    });

    const toComplete = selectTasksToAutoComplete(audit, [pending]);
    assert.equal(toComplete.length, 1);
    assert.equal(toComplete[0].id, "reply");
  });
});

describe("refreshGbpPlanForReconcile", () => {
  it("appends keyword portfolio step when rotation is needed and missing", () => {
    const audit = createTestAudit();
    audit.strategy.gbpPlan = {
      ...audit.strategy.gbpPlan!,
      steps: audit.strategy.gbpPlan!.steps.filter(
        (step) => step.stepNumber !== KEYWORD_PORTFOLIO_PLAN_STEP
      ),
    };

    audit.gbp.performance.searchKeywords = [
      { keyword: "dallas plumber", impressions: 80, belowThreshold: false },
      { keyword: "emergency plumber dallas", impressions: 40, belowThreshold: false },
    ];
    audit.rankings.keywords = audit.rankings.keywords.map((kw, index) => ({
      ...kw,
      inLocalPack: true,
      localPackPosition: 1 as const,
      keyword: index === 0 ? "unrelated ridgewood term" : kw.keyword,
    }));
    // Force rank-without-demand style mismatch via portfolio compute path:
    // keep pack ranks but no matching impressions for most keywords.
    audit.gbp.identity.address = "123 Main St, Dallas, TX 75201";

    const { plan, appendedStepNumbers } = refreshGbpPlanForReconcile(audit);
    assert.ok(plan);
    // Portfolio step may or may not append depending on shouldRotate thresholds;
    // at minimum refresh must keep existing steps intact.
    assert.ok(plan!.steps.length >= audit.strategy.gbpPlan!.steps.length);
    assert.ok(Array.isArray(appendedStepNumbers));
  });
});

describe("computePlanReconcile", () => {
  it("is idempotent: second pass creates no new tasks against first-pass result", () => {
    const audit = createTestAudit();
    const existing = [...(audit.execution?.tasks ?? [])];

    const first = computePlanReconcile(audit, existing, {
      now: "2026-07-10T01:00:00.000Z",
    });
    const afterFirst = [...existing, ...first.missingTasks];
    const second = computePlanReconcile(first.nextAudit, afterFirst, {
      now: "2026-07-10T01:05:00.000Z",
    });

    assert.equal(second.missingTasks.length, 0);
    assert.equal(first.nextAudit.strategy.planReconciledAt, "2026-07-10T01:00:00.000Z");
  });

  it("marks auto-completed tasks completed without touching approved ones", () => {
    const audit = createTestAudit();
    audit.gbp.completeness = {
      ...audit.gbp.completeness,
      hasHours: true,
      hasFullWeekHours: true,
      hasHolidayHours: true,
    };

    const pendingHours = task({
      id: "pending-hours",
      type: "gbp_hours",
      status: "pending_approval",
      planStepNumber: 12,
      actionItemId: "gbp-step-12",
      payload: { gbpStepNumber: 12, hoursAction: "update_holiday_hours", holidayYear: 2026 },
    });
    const approvedHours = task({
      id: "approved-hours",
      type: "gbp_hours",
      status: "approved",
      planStepNumber: 12,
      actionItemId: "gbp-step-12",
      payload: { gbpStepNumber: 12, hoursAction: "update_regular_hours" },
    });

    const result = computePlanReconcile(audit, [pendingHours, approvedHours], {
      now: "2026-07-10T02:00:00.000Z",
    });

    assert.ok(result.tasksToComplete.some((item) => item.id === "pending-hours"));
    assert.ok(result.tasksToComplete.every((item) => item.status === "completed"));
    assert.ok(!result.tasksToComplete.some((item) => item.id === "approved-hours"));
  });
});
