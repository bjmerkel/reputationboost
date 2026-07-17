import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "../phase3/test-fixtures";
import { isStepSatisfied } from "./counterfactual";
import {
  categoryLabelsMatch,
  filterActionableSecondaryCategories,
  isKeepAsPrimaryCategoryLabel,
  primaryCategoryUpdateIsNoOp,
  resolveLivePrimaryCategory,
  resolveRecommendedPrimaryCategory,
} from "./gbp-category";
import { inferRecommendedSecondaryCategories } from "./gbp-current-state";
import { buildAllGbpPlanSteps, selectGbpPlanSteps } from "./gbp-plan";
import { selectTasksToAutoComplete } from "../phase3/reconcile-plan";
import { tasksFromGbpPlanStep } from "../phase3/gbp-plan-tasks";
import { buildTemplateContent } from "@/lib/llm/content";
import type { ExecutionTask } from "../types";

function pendingPrimaryCategoryTask(overrides: Partial<ExecutionTask> = {}): ExecutionTask {
  return {
    id: "task-1",
    auditId: "2026-07-03",
    actionItemId: "gbp-step-1",
    type: "gbp_primary_category",
    title: "Primary Category",
    description: "",
    priority: "P0",
    status: "pending_approval",
    draftContent: "Day care center",
    payload: { primaryCategory: "Day care center", gbpStepNumber: 1 },
    requiresApproval: true,
    scheduledFor: null,
    completedAt: null,
    result: null,
    createdAt: "2026-07-03T12:00:00.000Z",
    planStepNumber: 1,
    ...overrides,
  };
}

describe("primary category plan no-op", () => {
  it("matches category labels ignoring case and spacing", () => {
    assert.equal(categoryLabelsMatch("Day care center", "Day Care Center"), true);
    assert.equal(categoryLabelsMatch("Day care center", "Daycare"), false);
  });

  it("treats matching live/recommended primary as satisfied even with low keyword fit", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Day care center";
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      primaryCategory: "Day care center",
      source: "oauth",
    };
    audit.rankings.keywords = [
      {
        keyword: "preschool near me",
        localPackPosition: "not_in_pack",
        inLocalPack: false,
        clientReviewCount: 10,
        packLeaderReviewCount: 40,
        packLeaderRating: 4.8,
        clientRating: 4.5,
        geoRanks: [],
      },
      {
        keyword: "toddler daycare",
        localPackPosition: "not_in_pack",
        inLocalPack: false,
        clientReviewCount: 10,
        packLeaderReviewCount: 40,
        packLeaderRating: 4.8,
        clientRating: 4.5,
        geoRanks: [],
      },
    ];

    assert.equal(resolveLivePrimaryCategory(audit), "Day care center");
    assert.equal(resolveRecommendedPrimaryCategory(audit), "Day care center");
    assert.equal(primaryCategoryUpdateIsNoOp(audit), true);
    assert.equal(isStepSatisfied(audit, 1), true);
    assert.equal(
      selectGbpPlanSteps(audit, buildAllGbpPlanSteps(audit)).some((s) => s.stepNumber === 1),
      false
    );
  });

  it("does not create a primary-category task when current equals recommended", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Day care center";
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      primaryCategory: "Day care center",
      source: "oauth",
    };
    const step = {
      stepNumber: 1,
      title: "Primary Category",
      instruction: "Update category",
      current: "Day care center",
      recommended: "Day care center",
      gbpAction: "update_primary_category" as const,
      actionData: { primaryCategory: "Day care center" },
    };
    audit.strategy.gbpPlan = {
      title: "Plan",
      businessName: audit.clientName,
      address: audit.gbp.identity.address,
      objective: "test",
      targetKeywords: [],
      currentState: { fields: [], profileGaps: [] },
      keywordRankings: [],
      steps: [step],
      keywordPriority: [],
      weeklyCadence: [],
      monthlyCadence: [],
      contentSource: "template",
    };

    const tasks = tasksFromGbpPlanStep(audit, step, buildTemplateContent(audit));
    assert.equal(tasks.length, 0);
  });

  it("auto-completes pending primary-category tasks that are no-ops", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Day care center";
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      primaryCategory: "Day care center",
      source: "oauth",
    };

    const completed = selectTasksToAutoComplete(audit, [pendingPrimaryCategoryTask()]);
    assert.equal(completed.length, 1);
    assert.equal(completed[0].id, "task-1");
  });

  it("keeps primary-category step open when live differs from recommended", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Preschool";
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      primaryCategory: "Day care center",
      source: "oauth",
    };

    assert.equal(primaryCategoryUpdateIsNoOp(audit), false);
    assert.equal(isStepSatisfied(audit, 1), false);
  });
});

describe("secondary categories never duplicate primary", () => {
  it("detects keep-as-primary placeholder labels", () => {
    assert.equal(isKeepAsPrimaryCategoryLabel("Air conditioning contractor (keep as primary)"), true);
    assert.equal(isKeepAsPrimaryCategoryLabel("Heating contractor"), false);
  });

  it("filters primary and keep-as-primary labels from secondary recommendations", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Air conditioning contractor";
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      primaryCategory: "Air conditioning contractor",
      secondaryCategories: [
        "HVAC contractor",
        "Heating contractor",
        "Furnace repair service",
        "Air conditioning repair service",
      ],
      source: "oauth",
    };

    assert.deepEqual(
      filterActionableSecondaryCategories(audit, [
        "Air conditioning contractor (keep as primary)",
        "Air conditioning contractor",
        "Water heater repair",
        "Water heater repair",
      ]),
      ["Water heater repair"]
    );
  });

  it("does not recommend the primary category as a secondary fallback", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Air conditioning contractor";
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      primaryCategory: "Air conditioning contractor",
      secondaryCategories: [
        "HVAC contractor",
        "Heating contractor",
        "Furnace repair service",
        "Air conditioning repair service",
      ],
      source: "oauth",
    };
    audit.rankings.keywords = [
      {
        keyword: "hvac air conditioning heating repair near newark nj",
        localPackPosition: "not_in_pack",
        inLocalPack: false,
        clientReviewCount: 10,
        packLeaderReviewCount: 40,
        packLeaderRating: 4.8,
        clientRating: 4.5,
        geoRanks: [],
      },
      {
        keyword: "ac repair",
        localPackPosition: "not_in_pack",
        inLocalPack: false,
        clientReviewCount: 10,
        packLeaderReviewCount: 40,
        packLeaderRating: 4.8,
        clientRating: 4.5,
        geoRanks: [],
      },
    ];

    const recommended = inferRecommendedSecondaryCategories(audit);
    assert.equal(recommended.length, 0);
    assert.equal(
      recommended.some((c) => /air conditioning contractor/i.test(c)),
      false
    );
    assert.equal(isStepSatisfied(audit, 2), true);
    assert.equal(
      selectGbpPlanSteps(audit, buildAllGbpPlanSteps(audit)).some((s) => s.stepNumber === 2),
      false
    );
  });

  it("does not create a secondary-category task for keep-as-primary payloads", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Air conditioning contractor";
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      primaryCategory: "Air conditioning contractor",
      secondaryCategories: ["HVAC contractor", "Heating contractor"],
      source: "oauth",
    };

    const step = {
      stepNumber: 2,
      title: "Add Secondary Categories",
      instruction: "Add secondary categories",
      current: "HVAC contractor, Heating contractor",
      recommended: "Air conditioning contractor (keep as primary)",
      gbpAction: "add_secondary_categories" as const,
      actionData: {
        secondaryCategories: ["Air conditioning contractor (keep as primary)"],
      },
    };

    const tasks = tasksFromGbpPlanStep(audit, step, buildTemplateContent(audit));
    assert.equal(tasks.length, 0);
  });

  it("auto-completes pending secondary tasks that only repeat the primary", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Air conditioning contractor";
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      primaryCategory: "Air conditioning contractor",
      secondaryCategories: ["HVAC contractor", "Heating contractor"],
      source: "oauth",
    };

    const task: ExecutionTask = {
      id: "task-secondary-1",
      auditId: "2026-07-03",
      actionItemId: "gbp-step-2",
      type: "gbp_secondary_categories",
      title: "Add Secondary Categories",
      description: "",
      priority: "P1",
      status: "pending_approval",
      draftContent: "Air conditioning contractor (keep as primary)",
      payload: {
        secondaryCategories: ["Air conditioning contractor (keep as primary)"],
        gbpStepNumber: 2,
      },
      requiresApproval: true,
      scheduledFor: null,
      completedAt: null,
      result: null,
      createdAt: "2026-07-03T12:00:00.000Z",
      planStepNumber: 2,
    };

    const completed = selectTasksToAutoComplete(audit, [task]);
    assert.equal(completed.length, 1);
    assert.equal(completed[0].id, "task-secondary-1");
  });
});
