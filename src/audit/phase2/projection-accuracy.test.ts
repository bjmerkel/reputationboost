import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ScoreDailySnapshot } from "@/audit/types/timeseries";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  pickActionsForDriverTarget,
  simulateStepDriverImpact,
} from "./counterfactual";
import { buildPathToHealthy } from "./path-to-healthy";
import {
  buildOutcomeProjectionAccuracySamples,
  buildProjectionAccuracySamples,
  buildRevenueProjectionAccuracySamples,
  computeObservedDriverImpact,
  computeObservedOutcomeImpact,
  medianDriverScoreInRange,
  medianOutcomeIndexInRange,
  summarizeProjectionAccuracy,
} from "./projection-accuracy";

describe("pickActionsForDriverTarget", () => {
  it("uses cumulative marginal gains that do not exceed isolated sum", () => {
    const audit = createTestAudit();
    const candidates = [
      { source: "plan" as const, id: "gbp-step-3" },
      { source: "plan" as const, id: "gbp-step-4" },
      { source: "plan" as const, id: "gbp-step-11" },
    ];

    const isolatedSum = [3, 4, 11].reduce(
      (sum, step) => sum + simulateStepDriverImpact(audit, step),
      0
    );

    const { selected, projection } = pickActionsForDriverTarget(audit, candidates, 15);
    const cumulativeSum = selected.reduce((sum, row) => sum + row.marginalDriverGain, 0);

    assert.ok(selected.length > 0);
    assert.equal(cumulativeSum, projection.driverGain);
    // Cumulative marginal gains can modestly exceed isolated sum when steps compound relevance.
    assert.ok(cumulativeSum <= isolatedSum * 1.2);
  });

  it("stops when no candidate adds marginal driver gain", () => {
    const audit = createTestAudit();
    const mutated = structuredClone(audit);
    mutated.gbp.content.photoCount = 80;
    mutated.gbp.content.lastPostDate = new Date().toISOString();
    mutated.reviews.unrespondedNegative = 0;
    mutated.gbp.engagement.responseRate = 1;

    const { selected } = pickActionsForDriverTarget(
      mutated,
      [
        { source: "plan", id: "gbp-step-6" },
        { source: "plan", id: "gbp-step-8" },
        { source: "plan", id: "gbp-step-11" },
      ],
      10
    );

    assert.equal(selected.length, 0);
  });
});

describe("buildPathToHealthy cumulative selection", () => {
  it("reports step impacts matching cumulative marginal gains", () => {
    const audit = createTestAudit();
    const path = buildPathToHealthy(audit);
    assert.ok(path);
    if (path!.steps.length === 0) return;

    const marginalSum = path!.steps.reduce((sum, step) => sum + step.scoreImpact, 0);
    assert.ok(marginalSum <= path!.projectedDriverScore - path!.currentDriverScore + 1);
    for (const step of path!.steps) {
      assert.ok(step.scoreImpact >= 0);
    }
  });
});

describe("projection accuracy", () => {
  const snapshots: ScoreDailySnapshot[] = [
    {
      businessId: "b1",
      date: "2026-06-01",
      overall: 42,
      driverScore: 40,
      visibility: 35,
      conversion: 40,
      revenueCapture: 30,
      source: "ingest",
    },
    {
      businessId: "b1",
      date: "2026-06-10",
      overall: 44,
      driverScore: 42,
      visibility: 36,
      conversion: 42,
      revenueCapture: 31,
      source: "ingest",
    },
    {
      businessId: "b1",
      date: "2026-06-20",
      overall: 48,
      driverScore: 46,
      visibility: 37,
      conversion: 46,
      revenueCapture: 32,
      source: "ingest",
    },
    {
      businessId: "b1",
      date: "2026-07-01",
      overall: 52,
      driverScore: 50,
      visibility: 38,
      conversion: 50,
      revenueCapture: 33,
      source: "ingest",
    },
  ];

  it("computes median driver score in a date range", () => {
    assert.equal(medianDriverScoreInRange(snapshots, "2026-06-01", "2026-06-15"), 41);
    assert.equal(medianDriverScoreInRange(snapshots, "2026-06-20", "2026-07-01"), 48);
  });

  it("computes median outcome index in a date range", () => {
    assert.equal(medianOutcomeIndexInRange(snapshots, "2026-06-01", "2026-06-15"), 34);
    assert.equal(medianOutcomeIndexInRange(snapshots, "2026-06-20", "2026-07-01"), 36);
  });

  it("computes observed driver impact around a published action", () => {
    const observed = computeObservedDriverImpact(
      snapshots,
      "2026-06-15T12:00:00.000Z",
      14,
      new Date("2026-07-10T00:00:00.000Z")
    );

    assert.equal(observed.driverScoreBefore, 41);
    assert.equal(observed.driverScoreAfter, 46);
    assert.equal(observed.observedDriverImpact, 5);
    assert.equal(observed.preliminary, false);
  });

  it("computes observed outcome impact around a published action", () => {
    const observed = computeObservedOutcomeImpact(
      snapshots,
      "2026-06-15T12:00:00.000Z",
      14,
      new Date("2026-07-10T00:00:00.000Z")
    );

    assert.equal(observed.outcomeIndexBefore, 34);
    assert.equal(observed.outcomeIndexAfter, 35);
    assert.equal(observed.observedOutcomeImpact, 1);
    assert.equal(observed.preliminary, false);
  });

  it("summarizes projection error samples", () => {
    const samples = buildProjectionAccuracySamples([
      {
        actionItemId: "gbp-step-3",
        projectedDriverImpact: 6,
        observedDriverImpact: 4,
      },
      {
        actionItemId: "gbp-step-11",
        projectedDriverImpact: 5,
        observedDriverImpact: 7,
        preliminary: false,
      },
      {
        actionItemId: "gbp-step-8",
        projectedDriverImpact: 3,
        observedDriverImpact: null,
      },
    ]);

    assert.equal(samples.length, 2);
    const summary = summarizeProjectionAccuracy(samples);
    assert.equal(summary.sampleSize, 2);
    assert.equal(summary.meanError, 0);
    assert.equal(summary.meanAbsError, 2);
  });

  it("builds outcome and revenue projection accuracy samples", () => {
    const outcomeSamples = buildOutcomeProjectionAccuracySamples([
      {
        actionItemId: "gbp-step-3",
        projectedOutcomeImpact: 5,
        observedOutcomeImpact: 3,
      },
    ]);
    assert.equal(outcomeSamples.length, 1);
    assert.equal(outcomeSamples[0].error, -2);

    const revenueSamples = buildRevenueProjectionAccuracySamples([
      {
        actionItemId: "gbp-step-4",
        projectedRevenueGain: 800,
        estimatedRevenue: 400,
      },
    ]);
    assert.equal(revenueSamples.length, 1);
    assert.equal(revenueSamples[0].error, -400);
  });
});
