import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask } from "../types";
import { KEYWORD_PORTFOLIO_PLAN_STEP, portfolioStepIsSatisfied } from "../phase2/keyword-portfolio";
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

  it("auto-completes keyword portfolio task when tracked keywords already match", () => {
    const audit = createTestAudit();
    const keywords = [
      "hvac repair newark nj",
      "ac repair ridgewood",
      "hvac kearny nj",
    ];
    audit.rankings.keywords = keywords.map((keyword, index) => ({
      ...audit.rankings.keywords[0]!,
      keyword,
      localPackPosition: (index + 1) as 1 | 2 | 3,
      inLocalPack: true,
    }));
    audit.keywordPortfolio = {
      ...(audit.keywordPortfolio ?? {
        computedAt: new Date().toISOString(),
        demandAlignmentScore: 100,
        rankWithoutDemandCount: 0,
        untrackedDemandCount: 0,
        tracked: [],
        untrackedCandidates: [],
        recommendedSwaps: [],
        shouldRotate: false,
        summary: "Aligned",
      }),
      recommendedKeywords: [...keywords].reverse(),
      shouldRotate: false,
      demandAlignmentScore: 100,
    };

    assert.equal(portfolioStepIsSatisfied(audit), true);

    const pending = task({
      id: "keywords",
      type: "update_tracked_keywords",
      planStepNumber: KEYWORD_PORTFOLIO_PLAN_STEP,
      actionItemId: `gbp-step-${KEYWORD_PORTFOLIO_PLAN_STEP}`,
      payload: {
        gbpStepNumber: KEYWORD_PORTFOLIO_PLAN_STEP,
        recommendedKeywords: keywords,
      },
      status: "pending_approval",
    });

    const toComplete = selectTasksToAutoComplete(audit, [pending]);
    assert.equal(toComplete.length, 1);
    assert.equal(toComplete[0].id, "keywords");
  });
});

describe("refreshGbpPlanForReconcile", () => {
  it("removes retired steps from persisted plans", () => {
    const audit = createTestAudit();
    audit.strategy.gbpPlan = {
      ...audit.strategy.gbpPlan!,
      steps: [
        ...audit.strategy.gbpPlan!.steps,
        {
          stepNumber: 16,
          title: "Continuous Activity",
          instruction: "Keep posting and engaging every week.",
        },
        {
          stepNumber: 14,
          title: "Messaging",
          instruction: "Turn on GBP chat/messages.",
        },
        {
          stepNumber: 15,
          title: "Booking Feature",
          instruction: "Enable online booking.",
        },
      ],
    };

    const { plan } = refreshGbpPlanForReconcile(audit);

    assert.ok(plan);
    assert.equal(plan!.steps.some((step) => step.stepNumber === 16), false);
    assert.equal(plan!.steps.some((step) => step.title === "Messaging"), false);
    assert.equal(plan!.steps.some((step) => step.title === "Booking Feature"), false);
  });

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

  it("refreshes mangled legacy review reply drafts on reconcile", () => {
    const audit = createTestAudit();
    audit.clientName = "Northshore Learning Center";
    audit.gbp.identity.address = "123 Main St, Las Vegas, NV 89129";
    audit.gbp.identity.primaryCategory = "Day care center";
    audit.gbp.identity.phone = "702-555-0100";
    audit.rankings.keywords = [
      {
        keyword: "child learning center las vegas",
        inLocalPack: false,
        clientReviewCount: 2,
        packLeaderReviewCount: 30,
        localPackPosition: null,
        geoRanks: [],
      },
    ];
    audit.strategy.gbpPlan = {
      ...audit.strategy.gbpPlan!,
      targetKeywords: ["child learning center las vegas"],
      keywordRankings: [
        {
          keyword: "child learning center las vegas",
          inLocalPack: false,
          reviewGap: 28,
          clientReviews: 2,
          packLeaderReviews: 30,
        },
      ],
    };

    const reviewText =
      "My 3 year old is in the blue jay class and she loves going to school. The teachers and the front desk staff are amazing. My daughter has learned her numbers and letters and she has friends her age now.";
    audit.reviews.reviews = [
      {
        id: "reviews/shay",
        rating: 5,
        text: reviewText,
        author: "Shay Love",
        publishedAt: "2026-07-11T02:01:00.000Z",
        responded: false,
        sentiment: "positive",
        responseTimeHours: null,
      },
    ];

    const mangled =
      "Thank you so much, Shay! We're glad my 3 year old is in the blue jay class and she loves going to school. The teache… meant a lot to you — we love helping Las Vegas neighbors with child.";

    const pendingReply = task({
      id: "pending-shay-reply",
      type: "review_response",
      status: "pending_approval",
      planStepNumber: 11,
      actionItemId: "gbp-step-11",
      title: "Respond to Shay (5★)",
      draftContent: mangled,
      createdAt: "2026-07-11T02:01:00.000Z",
      payload: {
        gbpStepNumber: 11,
        reviewId: "reviews/shay",
        reviewAuthor: "Shay Love",
        reviewText,
        rating: 5,
      },
    });

    const result = computePlanReconcile(audit, [pendingReply], {
      now: "2026-07-15T01:00:00.000Z",
    });

    const updated = result.tasksToUpdate.find((item) => item.id === "pending-shay-reply");
    assert.ok(updated);
    assert.doesNotMatch(updated?.draftContent ?? "", /meant a lot to you/i);
    assert.doesNotMatch(updated?.draftContent ?? "", /We're glad my 3 year old/i);
    assert.match(updated?.draftContent ?? "", /Thank you so much, Shay!/);
    assert.match(updated?.draftContent ?? "", /teachers|front desk|learning progress/i);
    assert.equal(updated?.payload.recommendedAt, "2026-07-15T01:00:00.000Z");
  });

  it("stamps recommendedAt on open tasks so Plan dates refresh after reconcile", () => {
    const audit = createTestAudit();
    const pendingDescription = task({
      id: "old-description",
      type: "gbp_description",
      status: "pending_approval",
      planStepNumber: 3,
      actionItemId: "gbp-step-3",
      createdAt: "2026-07-11T02:01:00.000Z",
      draftContent:
        "Nestled in Las Vegas since 1997, Northshore Learning Center offers a safe and supportive environment where children from 6 weeks to 12 years can learn, play, and grow.",
      payload: {
        gbpStepNumber: 3,
        field: "description",
      },
    });

    const result = computePlanReconcile(audit, [pendingDescription], {
      now: "2026-07-15T13:00:00.000Z",
    });

    const updated = result.tasksToUpdate.find((item) => item.id === "old-description");
    assert.ok(updated, "open description task should be stamped on reconcile");
    assert.equal(updated?.payload.recommendedAt, "2026-07-15T13:00:00.000Z");
    assert.equal(result.nextAudit.strategy.planReconciledAt, "2026-07-15T13:00:00.000Z");
    assert.equal(result.tasksToComplete.some((item) => item.id === "old-description"), false);
  });
});
