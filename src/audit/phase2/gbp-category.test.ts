import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "../phase3/test-fixtures";
import { isStepSatisfied } from "./counterfactual";
import {
  categoryLabelsMatch,
  primaryCategoryUpdateIsNoOp,
  resolveLivePrimaryCategory,
  resolveRecommendedPrimaryCategory,
} from "./gbp-category";
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
