import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "../phase3/test-fixtures";
import { buildTemplateGbpPlan } from "./gbp-plan";
import {
  isStepSatisfied,
  simulateGapDriverImpact,
  simulateStepDriverImpact,
  projectHealthScoresFromStepNumbers,
} from "./counterfactual";
import { computeHealthScores } from "./scoring";
import { estimateStepHealthImpact } from "./score-impact";
import { buildPathToHealthy } from "./path-to-healthy";
import { detectGaps } from "./gaps";

describe("counterfactual score simulation", () => {
  it("returns zero impact for already-satisfied steps", () => {
    const audit = createTestAudit();
    const mutated = structuredClone(audit);
    mutated.gbp.content.photoCount = 80;
    assert.ok(isStepSatisfied(mutated, 6));
    assert.equal(simulateStepDriverImpact(mutated, 6), 0);
  });

  it("derives step impact from computeHealthScores counterfactuals", () => {
    const audit = createTestAudit();
    const before = computeHealthScores(audit).driverScore;

    for (const stepNumber of [3, 6, 8, 11]) {
      const impact = simulateStepDriverImpact(audit, stepNumber);
      assert.ok(
        impact >= 0,
        `step ${stepNumber} impact should be non-negative, got ${impact}`
      );
      if (impact > 0) {
        const projected = projectHealthScoresFromStepNumbers(audit, [stepNumber]);
        assert.equal(projected.driverGain, impact);
        assert.ok(projected.projectedDriverScore >= before);
      }
    }
  });

  it("matches estimateStepHealthImpact when no calibration data exists", () => {
    const audit = createTestAudit();
    for (let step = 1; step <= 16; step++) {
      assert.equal(
        estimateStepHealthImpact(audit, step),
        simulateStepDriverImpact(audit, step)
      );
    }
  });

  it("derives gap impact from computeHealthScores counterfactuals", () => {
    const audit = createTestAudit();
    const gaps = detectGaps(audit);
    const unresponded = gaps.find((g) => g.id === "unresponded-negative");
    assert.ok(unresponded);
    assert.ok(simulateGapDriverImpact(audit, unresponded!) > 0);

    const rankGap = gaps.find((g) => g.id.startsWith("rank-outside-pack"));
    assert.ok(rankGap);
    assert.equal(simulateGapDriverImpact(audit, rankGap!), 0);
  });

  it("filters satisfied steps from the template plan", () => {
    const audit = createTestAudit();
    const plan = buildTemplateGbpPlan(audit);
    assert.ok(plan.steps.length > 0);
    assert.ok(plan.steps.length < 16);
    for (const step of plan.steps) {
      assert.equal(isStepSatisfied(audit, step.stepNumber), false);
    }
  });

  it("projects path-to-healthy scores via recomputation, not additive heuristics", () => {
    const audit = createTestAudit();
    const path = buildPathToHealthy(audit);
    assert.ok(path);
    assert.ok(path!.steps.length > 0);
    assert.ok(path!.projectedDriverScore >= path!.currentDriverScore);
    assert.ok(path!.projectedScore >= path!.currentScore);
    assert.ok(path!.projectedDriverScore <= 100);
    assert.ok(path!.projectedScore <= 100);
  });
});
