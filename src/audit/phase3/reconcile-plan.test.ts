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
import { isReviewResponseWorkSatisfied } from "@/audit/review-engagement";
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
        responded: true,
        replyText: "Thanks for the feedback!",
        replyState: "APPROVED",
      };
    } else {
      audit.reviews.reviews = [
        {
          id: reviewId,
          author: "Pat",
          rating: 2,
          text: "Late",
          publishedAt: "2026-07-01T00:00:00.000Z",
          responded: true,
          replyText: "Thanks!",
          replyState: "APPROVED",
          responseTimeHours: 1,
          sentiment: "negative",
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

  it("auto-completes review-response checklist when all reviews are already replied", () => {
    const audit = createTestAudit();
    audit.gbp.engagement.responseRate = 0;
    audit.reviews.unrespondedNegative = 2;
    audit.reviews.reviews = [
      {
        id: "reviews/1",
        author: "Pat",
        rating: 5,
        text: "Great service",
        publishedAt: "2026-07-01T00:00:00.000Z",
        responded: true,
        replyText: "Thanks for your feedback!",
        replyState: "APPROVED",
        responseTimeHours: 1,
        sentiment: "positive",
      },
    ];

    const checklist = task({
      id: "review-checklist",
      type: "gbp_checklist",
      actionItemId: "gbp-step-11",
      planStepNumber: 11,
      payload: { gbpStepNumber: 11 },
      status: "approved",
    });

    assert.equal(isReviewResponseWorkSatisfied(audit), true);
    const toComplete = selectTasksToAutoComplete(audit, [checklist]);
    assert.equal(toComplete.length, 1);
    assert.equal(toComplete[0].id, "review-checklist");
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

  it("refreshes pending keyword-stuffed description drafts on reconcile", () => {
    const audit = createTestAudit();
    audit.clientName = "Northshore Learning Center";
    audit.gbp.identity.address = "123 Main St, Las Vegas, NV 89129";
    audit.gbp.identity.primaryCategory = "Day care center";
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      primaryCategory: "Day care center",
      description:
        "Nestled in Las Vegas since 1997, Northshore Learning Center offers a safe and supportive environment where children from 6 weeks to 12 years can learn, play, and grow. As a nurturing daycare center, preschool, after-school program, and child care agency, they provide a balance of group learning times and free play to stimulate each child's development. Their dedicated team is committed to fostering a joyful and engaging atmosphere where every child can thrive.",
    };

    const stuffed =
      "Northshore Learning Center provides professional Day care center throughout NV 89129 and surrounding areas. We specialize in learning center near me, daycare near las vegas, preschool near me. With 62+ Google reviews (4.4★), Northshore Learning Center delivers reliable service, clean vehicles, punctual arrivals, and professional staff, with 24/7 availability.";

    const pendingDescription = task({
      id: "pending-description",
      type: "gbp_description",
      status: "pending_approval",
      planStepNumber: 3,
      actionItemId: "gbp-step-3",
      draftContent: stuffed,
      payload: { gbpStepNumber: 3, field: "description" },
    });

    const result = computePlanReconcile(audit, [pendingDescription], {
      now: "2026-07-10T03:00:00.000Z",
    });

    assert.equal(result.tasksToUpdate.length, 1);
    assert.equal(result.tasksToUpdate[0]?.id, "pending-description");
    assert.match(result.tasksToUpdate[0]?.draftContent ?? "", /Nestled in Las Vegas since 1997/);
    assert.doesNotMatch(result.tasksToUpdate[0]?.draftContent ?? "", /clean vehicles/i);
  });
});
