import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { buildPlan } from "./build-plan";
import { getPhaseForStep, PLAN_PHASE_DEFINITIONS } from "./plan-phases";
import { resolvePlanStepNumber } from "./plan-task-utils";
import { createTestAudit } from "./test-fixtures";

describe("plan-phases", () => {
  it("maps step numbers to phases", () => {
    assert.equal(getPhaseForStep(1), "foundation");
    assert.equal(getPhaseForStep(6), "content");
    assert.equal(getPhaseForStep(11), "reputation");
    assert.equal(getPhaseForStep(16), "ongoing");
  });

  it("defines all core plan steps across phases", () => {
    const covered = PLAN_PHASE_DEFINITIONS.flatMap((p) => p.stepNumbers);
    assert.equal(covered.length, 18);
    assert.deepEqual([...new Set(covered)].sort((a, b) => a - b), [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ]);
  });

  it("maps custom plan steps to ongoing phase", () => {
    assert.equal(getPhaseForStep(17), "ongoing");
    assert.equal(getPhaseForStep(18), "ongoing");
  });
});

describe("resolvePlanStepNumber", () => {
  it("reads from planStepNumber field", () => {
    const task = createTestAudit().execution!.tasks[0];
    assert.equal(resolvePlanStepNumber({ ...task, planStepNumber: 7 }), 7);
  });

  it("falls back to action_item_id", () => {
    const task = createTestAudit().execution!.tasks[0];
    assert.equal(
      resolvePlanStepNumber({
        ...task,
        planStepNumber: null,
        actionItemId: "gbp-step-3",
        payload: {},
      }),
      3
    );
  });
});

describe("buildPlan", () => {
  it("returns null when gbpPlan is missing", () => {
    const audit = createTestAudit();
    const plan = buildPlan(
      { ...audit, strategy: { ...audit.strategy, gbpPlan: null } },
      audit.execution!.tasks
    );
    assert.equal(plan, null);
  });

  it("assembles plan steps with tasks grouped by step number", () => {
    const audit = createTestAudit();
    const tasks = audit.execution!.tasks;
    const plan = buildPlan(audit, tasks);

    assert.ok(plan);
    assert.ok(plan!.steps.length > 0);
    assert.ok(plan!.steps.length <= 17);
    assert.equal(plan!.progress.totalSteps, plan!.steps.length);
    assert.ok(plan!.progress.currentHealthScore >= 0);
    assert.ok(Number.isFinite(plan!.progress.currentHealthScore));
    assert.ok(plan!.progress.projectedHealthScore >= plan!.progress.currentHealthScore);

    const step3 = plan!.steps.find((s) => s.stepNumber === 3);
    assert.ok(step3);
    assert.ok(step3!.tasks.length > 0);
    assert.equal(step3!.phaseId, "foundation");
    assert.ok(step3!.context.expectedEffect.length > 0);
    assert.ok(step3!.context.targetKeywords.length > 0);
    assert.ok((step3!.context.healthScoreImpact ?? 0) > 0);

    const tasksForStep3 = tasks.filter((t) => resolvePlanStepNumber(t) === 3);
    assert.equal(step3!.tasks.length, tasksForStep3.length);
  });

  it("counts steps needing approval", () => {
    const audit = createTestAudit();
    const plan = buildPlan(audit, audit.execution!.tasks);
    assert.ok(plan);
    assert.ok(plan!.progress.needsApproval > 0);
    assert.equal(
      plan!.progress.needsApproval,
      plan!.steps.filter((s) => s.status === "needs_approval").length
    );
  });

  it("attaches outcomes from attributions to completed steps", () => {
    const audit = createTestAudit();
    const tasks = audit.execution!.tasks.map((t) =>
      resolvePlanStepNumber(t) === 3
        ? { ...t, status: "completed" as const, completedAt: "2026-06-03T10:00:00.000Z" }
        : t
    );

    const attributions: ActionAttribution[] = [
      {
        id: "attr-1",
        executionTaskId: tasks.find((t) => resolvePlanStepNumber(t) === 3)!.id,
        businessId: "biz-1",
        taskType: "gbp_description",
        actionItemId: "gbp-step-3",
        title: "Step 3: Rewrite the Business Description",
        publishedAt: "2026-06-03T10:00:00.000Z",
        windowDays: 14,
        primaryKeyword: "emergency plumber dallas",
        rankBefore: 7,
        rankAfter: 4,
        rankDelta: -3,
        keywordsImproved: 1,
        callsDelta: 5,
        directionsDelta: null,
        websiteClicksDelta: null,
        impressionsDelta: null,
        estimatedRevenue: null,
        narrative: "Rank improved after description update.",
        preliminary: false,
        computedAt: "2026-06-17T10:00:00.000Z",
      },
    ];

    const plan = buildPlan(audit, tasks, attributions);
    const step3 = plan!.steps.find((s) => s.stepNumber === 3);
    assert.ok(step3?.outcome);
    assert.equal(step3!.outcome!.rankBefore, 7);
    assert.equal(step3!.outcome!.rankAfter, 4);
    assert.match(step3!.outcome!.narrative ?? "", /emergency plumber dallas/);
  });

  it("enriches generated tasks with plan step fields and context payload", () => {
    const audit = createTestAudit();
    const task = audit.execution!.tasks.find((t) => resolvePlanStepNumber(t) === 3);
    assert.ok(task);
    assert.equal(task!.planStepNumber, 3);
    assert.equal(task!.planPhaseId, "foundation");
    assert.ok(typeof task!.payload.expectedEffect === "string");
    assert.ok(Array.isArray(task!.payload.targetKeywords));
  });

  it("keeps video and media tasks out of the Google updates step", () => {
    const audit = createTestAudit();
    const tasks = [
      {
        ...audit.execution!.tasks[0],
        id: "google-accept-1",
        planStepNumber: 0,
        actionItemId: "google-suggestion-title",
        type: "gbp_accept_suggestion" as const,
        title: "Accept Google change: Business name",
        status: "pending_approval" as const,
      },
      {
        ...audit.execution!.tasks[0],
        id: "video-gap-1",
        planStepNumber: 7,
        actionItemId: "video-gap-1",
        type: "gbp_video" as const,
        title: "Business walkthrough video",
        status: "pending_approval" as const,
      },
      {
        ...audit.execution!.tasks[0],
        id: "media-maint-1",
        planStepNumber: 6,
        actionItemId: "media-maint-1",
        type: "gbp_media_delete" as const,
        title: "Remove low-performing photo",
        status: "pending_approval" as const,
      },
    ];

    const plan = buildPlan(audit, tasks);
    assert.ok(plan);

    const googleUpdates = plan!.steps.find((s) => s.stepNumber === 0);
    assert.ok(googleUpdates);
    assert.equal(googleUpdates!.tasks.length, 1);
    assert.equal(googleUpdates!.tasks[0].type, "gbp_accept_suggestion");
    assert.equal(googleUpdates!.context.targetKeywords.length, 0);

    const videoStep = plan!.steps.find((s) => s.stepNumber === 7);
    assert.ok(videoStep);
    assert.ok(videoStep!.tasks.some((task) => task.type === "gbp_video"));

    const photoStep = plan!.steps.find((s) => s.stepNumber === 6);
    assert.ok(photoStep);
    assert.ok(photoStep!.tasks.some((task) => task.type === "gbp_media_delete"));
  });

  it("places custom steps in the ongoing phase and excludes them from score projection", () => {
    const audit = createTestAudit();
    const customStep = {
      stepNumber: 18,
      title: "Airport route video",
      instruction: "Upload a 45-second airport pickup video.\n\nWhy this step: Targets airport shuttle keyword gap.",
      gbpAction: "manual" as const,
    };
    const auditWithCustom = {
      ...audit,
      strategy: {
        ...audit.strategy,
        gbpPlan: {
          ...audit.strategy.gbpPlan!,
          steps: [...audit.strategy.gbpPlan!.steps, customStep],
        },
      },
    };

    const customTask = {
      ...audit.execution!.tasks[0],
      id: "custom-task-18",
      actionItemId: "gbp-step-18",
      planStepNumber: 18,
      planPhaseId: "ongoing" as const,
      type: "gbp_checklist" as const,
      title: "Step 18: Airport route video",
      payload: {
        gbpStepNumber: 18,
        isCustomPlanStep: true,
        customAction: true,
        expectedEffect: "Targets airport shuttle keyword gap.",
      },
    };

    const plan = buildPlan(auditWithCustom, [...audit.execution!.tasks, customTask]);
    assert.ok(plan);

    const step18 = plan!.steps.find((s) => s.stepNumber === 18);
    assert.ok(step18);
    assert.equal(step18!.phaseId, "ongoing");
    assert.equal(step18!.context.healthScoreImpact, undefined);
    assert.match(step18!.context.expectedEffect, /airport shuttle/i);

    const ongoingPhase = plan!.phases.find((p) => p.id === "ongoing");
    assert.ok(ongoingPhase);
    assert.ok(ongoingPhase!.stepNumbers.includes(18));
    assert.ok(ongoingPhase!.stepNumbers.includes(16));

    const planWithoutCustomProjection = buildPlan(audit, audit.execution!.tasks);
    assert.equal(
      plan!.progress.projectedHealthScore,
      planWithoutCustomProjection!.progress.projectedHealthScore
    );
  });
});
