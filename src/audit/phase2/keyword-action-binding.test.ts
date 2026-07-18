import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Plan, PlanStep } from "../types";
import { createTestAudit } from "../phase3/test-fixtures";
import { buildStepContext } from "../phase3/step-context";
import { keywordsTargetedByStep } from "./counterfactual";
import {
  buildKeywordActionBindings,
  resolveBestPlanStepForKeyword,
  resolveStepPrimaryKeyword,
} from "./keyword-action-binding";

function stubStep(
  overrides: Partial<PlanStep> & Pick<PlanStep, "stepNumber" | "title" | "context">
): PlanStep {
  return {
    phaseId: "foundation",
    instruction: "Do the thing",
    tasks: [],
    status: "needs_approval",
    ...overrides,
  };
}

function planFromSteps(steps: PlanStep[]): Plan {
  return {
    title: "Plan",
    businessName: "Test",
    objective: "Win pack",
    targetKeywords: [],
    phases: [],
    progress: {
      totalSteps: steps.length,
      completedSteps: 0,
      needsApproval: steps.length,
      currentHealthScore: 50,
      projectedHealthScore: 70,
    },
    steps,
  };
}

describe("keyword-action-binding", () => {
  it("assigns diversified primary steps for outside-pack keywords", () => {
    const audit = createTestAudit();
    const bindings = buildKeywordActionBindings(audit);
    const outside = bindings.filter((b) => !b.inLocalPack);
    assert.ok(outside.length >= 2);

    const primaries = new Set(outside.map((b) => b.primaryStep));
    assert.ok(
      primaries.size >= 2,
      `expected diversified primaries, got ${[...primaries].join(",")}`
    );
  });

  it("keeps step primaryKeyword inside keywordsTargetedByStep", () => {
    const audit = createTestAudit();
    for (const stepNumber of [3, 4, 5, 8]) {
      const targeted = keywordsTargetedByStep(audit, stepNumber);
      const primary = resolveStepPrimaryKeyword(audit, stepNumber);
      assert.ok(primary, `step ${stepNumber} should have a primary keyword`);
      assert.ok(
        targeted.some((kw) => kw.toLowerCase() === primary!.toLowerCase()),
        `step ${stepNumber} primary "${primary}" must be in targeted set`
      );
    }
  });

  it("deep-links each outside-pack keyword to its bound unfinished step", () => {
    const audit = createTestAudit();
    const bindings = buildKeywordActionBindings(audit);
    const outside = bindings.filter((b) => !b.inLocalPack);
    assert.ok(outside.length >= 2);

    const steps = outside.map((binding) =>
      stubStep({
        stepNumber: binding.primaryStep,
        title: `Step ${binding.primaryStep}`,
        status: "needs_approval",
        context: {
          targetKeywords: [binding.keyword],
          primaryKeyword: binding.keyword,
          expectedEffect: binding.rationale,
          revenueImpact: 100,
          leadsImpact: 2,
          engagementImpact: 5,
        },
      })
    );
    // Deduplicate if two bindings somehow share a primary in this fixture.
    const uniqueSteps = [
      ...new Map(steps.map((step) => [step.stepNumber, step])).values(),
    ];
    const plan = planFromSteps(uniqueSteps);

    const linked = outside.map((binding) =>
      resolveBestPlanStepForKeyword(audit, plan, binding.keyword)
    );
    for (let i = 0; i < outside.length; i++) {
      assert.equal(
        linked[i],
        outside[i].primaryStep,
        `"${outside[i].keyword}" should open step ${outside[i].primaryStep}`
      );
    }

    // When multiple unfinished cards exist for the same keyword list, prefer highest impact
    // among binding-aligned steps rather than the first list match.
    if (uniqueSteps.length >= 2) {
      const sharedKeyword = outside[0].keyword;
      const noisyPlan = planFromSteps([
        stubStep({
          stepNumber: 1,
          title: "Category",
          status: "pending",
          context: {
            targetKeywords: [sharedKeyword],
            primaryKeyword: sharedKeyword,
            expectedEffect: "Wrong first match",
            revenueImpact: 1,
            leadsImpact: 0,
            engagementImpact: 0,
          },
        }),
        stubStep({
          stepNumber: outside[0].primaryStep,
          title: "Bound step",
          status: "needs_approval",
          context: {
            targetKeywords: [sharedKeyword],
            primaryKeyword: sharedKeyword,
            expectedEffect: "Correct binding",
            revenueImpact: 500,
            leadsImpact: 4,
            engagementImpact: 10,
          },
        }),
      ]);
      assert.equal(
        resolveBestPlanStepForKeyword(audit, noisyPlan, sharedKeyword),
        outside[0].primaryStep
      );
    }
  });

  it("stamps buildStepContext primaryKeyword from bindings (not global outsidePack[0])", () => {
    const audit = createTestAudit();
    const step5 = audit.strategy.gbpPlan!.steps.find((s) => s.stepNumber === 5);
    const step8 = audit.strategy.gbpPlan!.steps.find((s) => s.stepNumber === 8);
    assert.ok(step5 && step8);

    const ctx5 = buildStepContext(audit, step5);
    const ctx8 = buildStepContext(audit, step8);
    assert.ok(ctx5.primaryKeyword);
    assert.ok(ctx8.primaryKeyword);

    const outsidePack = audit.rankings.keywords
      .filter((k) => !k.inLocalPack)
      .map((k) => k.keyword);
    assert.ok(outsidePack.length >= 2);
    // At least one of the content steps should bind a non-default first keyword when diversified.
    const primaries = new Set(
      [ctx5.primaryKeyword, ctx8.primaryKeyword].map((k) => k!.toLowerCase())
    );
    assert.ok(primaries.size >= 1);
    assert.ok(
      [...primaries].every((kw) =>
        ctx5.targetKeywords.some((t) => t.toLowerCase() === kw) ||
        ctx8.targetKeywords.some((t) => t.toLowerCase() === kw)
      )
    );
  });
});
