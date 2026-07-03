import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { buildPlan } from "./build-plan";
import { buildPlanTimeline } from "./build-timeline";
import { resolvePlanStepNumber } from "./plan-task-utils";
import {
  buildOutcomeFromAttribution,
  findStepOutcome,
  formatOutcomeRank,
} from "./step-outcomes";
import { createTestAudit } from "./test-fixtures";

describe("formatOutcomeRank", () => {
  it("formats ranks for display", () => {
    assert.equal(formatOutcomeRank(null), "—");
    assert.equal(formatOutcomeRank(3), "#3");
    assert.equal(formatOutcomeRank(21), "#20+");
  });
});

describe("buildOutcomeFromAttribution", () => {
  it("builds rank-change narrative when keyword moved", () => {
    const attr: ActionAttribution = {
      id: "attr-1",
      executionTaskId: "task-1",
      businessId: "biz-1",
      taskType: "gbp_description",
      actionItemId: "gbp-step-3",
      title: "Rewrite description",
      publishedAt: "2026-06-03T10:00:00.000Z",
      windowDays: 14,
      primaryKeyword: "emergency plumber dallas",
      rankBefore: 7,
      rankAfter: 4,
      rankDelta: -3,
      keywordsImproved: 1,
      callsDelta: null,
      directionsDelta: null,
      websiteClicksDelta: null,
      impressionsDelta: null,
      estimatedRevenue: null,
      narrative: "Rank improved after description update.",
      preliminary: false,
      computedAt: "2026-06-17T10:00:00.000Z",
    };

    const outcome = buildOutcomeFromAttribution(attr);
    assert.equal(outcome.rankBefore, 7);
    assert.equal(outcome.rankAfter, 4);
    assert.match(outcome.narrative ?? "", /emergency plumber dallas/);
    assert.match(outcome.narrative ?? "", /#7/);
    assert.match(outcome.narrative ?? "", /#4/);
  });
});

describe("findStepOutcome", () => {
  it("prefers attribution matched by action item id", () => {
    const audit = createTestAudit();
    const tasks = audit.execution!.tasks;
    const step3Task = tasks.find((t) => resolvePlanStepNumber(t) === 3)!;
    const completedTasks = tasks.map((t) =>
      resolvePlanStepNumber(t) === 3
        ? { ...t, status: "completed" as const, completedAt: "2026-06-03T10:00:00.000Z" }
        : t
    );

    const attributions: ActionAttribution[] = [
      {
        id: "attr-1",
        executionTaskId: step3Task.id,
        businessId: "biz-1",
        taskType: "gbp_description",
        actionItemId: "gbp-step-3",
        title: "Step 3",
        publishedAt: "2026-06-03T10:00:00.000Z",
        windowDays: 14,
        primaryKeyword: "plumber near me",
        rankBefore: 5,
        rankAfter: 3,
        rankDelta: -2,
        keywordsImproved: 1,
        callsDelta: null,
        directionsDelta: null,
        websiteClicksDelta: null,
        impressionsDelta: null,
        estimatedRevenue: null,
        narrative: "Improved.",
        preliminary: false,
        computedAt: "2026-06-17T10:00:00.000Z",
      },
    ];

    const outcome = findStepOutcome(3, completedTasks, attributions);
    assert.equal(outcome?.rankAfter, 3);
    assert.equal(outcome?.attributionId, "attr-1");
  });

  it("falls back to completed task result when no attribution", () => {
    const audit = createTestAudit();
    const tasks = audit.execution!.tasks.map((t) =>
      resolvePlanStepNumber(t) === 3
        ? {
            ...t,
            status: "completed" as const,
            completedAt: "2026-06-03T10:00:00.000Z",
            result: "Description published successfully.",
          }
        : t
    );

    const outcome = findStepOutcome(3, tasks, []);
    assert.equal(outcome?.narrative, "Description published successfully.");
  });
});

describe("buildPlanTimeline", () => {
  it("always includes a baseline entry", () => {
    const audit = createTestAudit();
    const plan = buildPlan(audit, audit.execution!.tasks);
    const entries = buildPlanTimeline(audit, plan, []);

    const baseline = entries.find((e) => e.kind === "baseline");
    assert.ok(baseline);
    assert.equal(baseline!.id, `baseline-${audit.auditId}`);
  });

  it("maps attributions to action timeline entries", () => {
    const audit = createTestAudit();
    const tasks = audit.execution!.tasks;
    const step3Task = tasks.find((t) => resolvePlanStepNumber(t) === 3)!;

    const attributions: ActionAttribution[] = [
      {
        id: "attr-1",
        executionTaskId: step3Task.id,
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
    const entries = buildPlanTimeline(audit, plan, attributions);

    const action = entries.find((e) => e.id === "attr-1");
    assert.ok(action);
    assert.equal(action!.kind, "action");
    assert.equal(action!.stepNumber, 3);
    assert.match(action!.narrative, /\+5 calls/);
  });

  it("includes rank shift entries from month-over-month data", () => {
    const audit = createTestAudit();
    audit.strategy!.monthOverMonth = {
      keywordsInPackChange: 0,
      reviewCountChange: 0,
      callsChange: 3,
      directionRequestsChange: 0,
      websiteClicksChange: 0,
      shareOfVoiceChange: 0,
      overallScoreChange: 4,
      visibilityScoreChange: 3,
      conversionScoreChange: 1,
      revenueCaptureScoreChange: 0,
      improvedKeywords: ["plumber near me"],
      declinedKeywords: [],
      rankMovements: [
        {
          keyword: "plumber near me",
          fromPosition: 5,
          toPosition: 3,
          improved: true,
        },
      ],
      competitorDeltas: [],
    };

    const entries = buildPlanTimeline(audit, buildPlan(audit, audit.execution!.tasks), []);
    const rankShift = entries.find((e) => e.kind === "rank_shift");
    assert.ok(rankShift);
    assert.equal(rankShift!.keyword, "plumber near me");
    assert.match(rankShift!.narrative, /#5/);
    assert.match(rankShift!.narrative, /#3/);
  });

  it("deduplicates step outcomes already covered by attributions", () => {
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
        title: "Step 3",
        publishedAt: "2026-06-03T10:00:00.000Z",
        windowDays: 14,
        primaryKeyword: "emergency plumber dallas",
        rankBefore: 7,
        rankAfter: 4,
        rankDelta: -3,
        keywordsImproved: 1,
        callsDelta: null,
        directionsDelta: null,
        websiteClicksDelta: null,
        impressionsDelta: null,
        estimatedRevenue: null,
        narrative: "Rank improved.",
        preliminary: false,
        computedAt: "2026-06-17T10:00:00.000Z",
      },
    ];

    const plan = buildPlan(audit, tasks, attributions);
    const entries = buildPlanTimeline(audit, plan, attributions);
    const stepEntries = entries.filter((e) => e.stepNumber === 3 && e.kind === "action");
    assert.equal(stepEntries.length, 1);
    assert.equal(stepEntries[0]!.id, "attr-1");
  });
});
