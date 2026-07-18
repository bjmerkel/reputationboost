import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "../phase3/test-fixtures";
import { buildPlan } from "../phase3/build-plan";
import { buildTemplateGbpPlan } from "./gbp-plan";
import { pickActionsForDriverTarget, pickActionsForTarget } from "./counterfactual";
import { buildPathToHealthy } from "./path-to-healthy";
import { resolvePathOptimizationMode } from "./path-optimization";
import { computeHealthScores } from "./scoring";

describe("resolvePathOptimizationMode", () => {
  it("defaults to balanced when average customer value is unset", () => {
    const mode = resolvePathOptimizationMode({}, { driverScore: 55, outcomeIndex: 30 });
    assert.equal(mode, "balanced");
  });

  it("prefers revenue when rankings lag profile strength", () => {
    const mode = resolvePathOptimizationMode(
      { avgCustomerValue: 350 },
      { driverScore: 58, outcomeIndex: 32 }
    );
    assert.equal(mode, "revenue");
  });

  it("uses balanced when ACV is set but outcome is not the bottleneck", () => {
    const mode = resolvePathOptimizationMode(
      { avgCustomerValue: 350 },
      { driverScore: 45, outcomeIndex: 50 }
    );
    assert.equal(mode, "balanced");
  });

  it("honors explicit mode overrides", () => {
    assert.equal(
      resolvePathOptimizationMode(
        { mode: "outcome", avgCustomerValue: 350 },
        { driverScore: 40, outcomeIndex: 20 }
      ),
      "outcome"
    );
  });
});

describe("pickActionsForTarget", () => {
  it("driver mode matches pickActionsForDriverTarget", () => {
    const audit = createTestAudit();
    const candidates = [
      { source: "plan" as const, id: "gbp-step-3" },
      { source: "plan" as const, id: "gbp-step-4" },
      { source: "plan" as const, id: "gbp-step-11" },
    ];

    const driverOnly = pickActionsForDriverTarget(audit, candidates, 12);
    const explicit = pickActionsForTarget(
      audit,
      candidates,
      { mode: "driver", driverPointsNeeded: 12 }
    );

    assert.equal(driverOnly.selected.length, explicit.selected.length);
    assert.equal(driverOnly.projection.driverGain, explicit.projection.driverGain);
    assert.deepEqual(
      driverOnly.selected.map((row) => row.id),
      explicit.selected.map((row) => row.id)
    );
  });

  it("returns outcome and revenue marginals on selected actions", () => {
    const audit = createTestAudit();
    const withKeywords = {
      ...audit,
      gbp: {
        ...audit.gbp,
        performance: {
          ...audit.gbp.performance,
          searchKeywords: audit.rankings.keywords.map((kw) => ({
            keyword: kw.keyword,
            impressions: 600,
            belowThreshold: false,
          })),
        },
      },
    };

    const outsideKeyword = withKeywords.rankings.keywords.find((k) => !k.inLocalPack)?.keyword;
    assert.ok(outsideKeyword);

    const { selected } = pickActionsForTarget(
      withKeywords,
      [{ source: "gap", id: `rank-outside-pack-${outsideKeyword}` }],
      { mode: "revenue", driverPointsNeeded: 1, revenueGainNeeded: 1 },
      { avgCustomerValue: 350 }
    );

    assert.equal(selected.length, 1);
    assert.ok(selected[0]!.marginalOutcomeGain >= 0);
    assert.ok(selected[0]!.marginalRevenueGain != null);
  });
});

describe("buildPathToHealthy multi-objective path", () => {
  it("includes optimization mode and revenue fields when ACV is set", () => {
    const audit = createTestAudit();
    const withKeywords = {
      ...audit,
      gbp: {
        ...audit.gbp,
        performance: {
          ...audit.gbp.performance,
          searchKeywords: audit.rankings.keywords.map((kw) => ({
            keyword: kw.keyword,
            impressions: 500,
            belowThreshold: false,
          })),
        },
      },
    };

    const path = buildPathToHealthy(withKeywords, null, {
      avgCustomerValue: 350,
      currency: "USD",
    });

    assert.ok(path);
    assert.ok(path!.optimizationMode);
    assert.ok(path!.estimatedMonthlyRevenue != null);
    assert.ok(path!.projectedDriverScore >= path!.currentDriverScore);
  });

  it("populates per-step driver and outcome impacts", () => {
    const audit = createTestAudit();
    const path = buildPathToHealthy(audit, null, { mode: "driver" });
    assert.ok(path);
    if (path!.steps.length === 0) return;

    for (const step of path!.steps) {
      assert.equal(step.scoreImpact, step.driverImpact);
      assert.ok(step.driverImpact != null && step.driverImpact >= 0);
      assert.ok(step.outcomeImpact != null && step.outcomeImpact >= 0);
    }
  });

  it("respects explicit driver mode for selection", () => {
    const audit = createTestAudit();
    const autoPath = buildPathToHealthy(audit, null, {
      avgCustomerValue: 350,
      mode: "balanced",
    });
    const driverPath = buildPathToHealthy(audit, null, {
      avgCustomerValue: 350,
      mode: "driver",
    });

    assert.ok(autoPath);
    assert.ok(driverPath);
    assert.equal(autoPath!.optimizationMode, "balanced");
    assert.equal(driverPath!.optimizationMode, "driver");
    assert.ok(driverPath!.projectedDriverScore >= driverPath!.currentDriverScore);
  });

  it("reports revenue capture on the path summary", () => {
    const audit = createTestAudit();
    const scores = computeHealthScores(audit);
    const path = buildPathToHealthy(audit, null, { mode: "driver" });
    assert.ok(path);
    assert.equal(path!.currentRevenueCapture, scores.revenueCapture);
    assert.ok(path!.projectedRevenueCapture != null);
  });

  it("exposes separate next-three and full-path revenue projections when a plan exists", () => {
    const audit = createTestAudit();
    const gbpPlan = buildTemplateGbpPlan(audit, { avgCustomerValue: 350 });
    audit.strategy.gbpPlan = gbpPlan;
    const plan = buildPlan(audit, audit.execution?.tasks ?? [], [], undefined, 350);
    assert.ok(plan);

    const path = buildPathToHealthy(audit, plan, {
      avgCustomerValue: 350,
      preferPlanDisplayOrder: true,
    });

    assert.ok(path);
    assert.ok(path!.nextThreeStepCount != null && path!.nextThreeStepCount! > 0);
    assert.ok(path!.pathStepCount != null);
    assert.equal(path!.nextThreeEstimatedMonthlyRevenue, path!.estimatedMonthlyRevenue);
    if ((path!.pathStepCount ?? 0) > (path!.nextThreeStepCount ?? 0)) {
      assert.ok(
        (path!.projectedMonthlyRevenue ?? 0) >= (path!.nextThreeProjectedMonthlyRevenue ?? 0)
      );
    }
  });
});
