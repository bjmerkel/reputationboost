import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RankingExperiment } from "./types";
import {
  buildExperimentStepCalibration,
  mergeExperimentCalibrations,
  winningExperimentStepsByKeyword,
} from "./experiment-step-calibration";
import {
  buildExperimentPeriodSummary,
  buildExperimentResultNarrative,
} from "./experiment-narrative";

function experiment(
  overrides: Partial<RankingExperiment> & Pick<RankingExperiment, "status">
): RankingExperiment {
  return {
    id: "exp-1",
    businessId: "biz-1",
    userId: "user-1",
    auditId: "audit-1",
    keyword: "emergency plumber",
    gridNorth: 0.5,
    gridEast: 0,
    leaderPlaceId: "leader-1",
    leaderName: "Ace Plumbing",
    actionType: "review_request",
    planStepNumber: 10,
    hypothesis: "Close the review gap.",
    leaderDelta: {} as RankingExperiment["leaderDelta"],
    marketKey: "plumber|TX|dallas",
    origin: "manual",
    banditMetadata: null,
    status: overrides.status,
    executionTaskId: null,
    baselineSnapshotDate: "2026-01-01",
    targetRankBefore: overrides.targetRankBefore ?? 12,
    targetRankAfter: overrides.targetRankAfter ?? 8,
    targetCellImproved: overrides.targetCellImproved ?? true,
    attributionWindowDays: 14,
    startedAt: "2026-01-02T00:00:00.000Z",
    concludedAt: "2026-01-16T00:00:00.000Z",
    conclusionReason: overrides.conclusionReason ?? null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("experiment-step-calibration", () => {
  it("boosts plan steps with winning cell experiments", () => {
    const calibration = buildExperimentStepCalibration([
      experiment({ status: "won", targetRankBefore: 12, targetRankAfter: 8 }),
    ]);
    assert.equal(calibration[10]?.sampleSize, 1);
    assert.ok((calibration[10]?.medianRankDelta ?? 0) > 0);
    assert.ok((calibration[10]?.estimatedScoreImpact ?? 0) > 0);
  });

  it("merges experiment calibration over weaker attribution samples", () => {
    const merged = mergeExperimentCalibrations(
      {
        10: {
          sampleSize: 1,
          medianRankDelta: 0,
          medianCallsDelta: 0,
          medianDirectionsDelta: 0,
          medianWebsiteClicksDelta: 0,
          estimatedScoreImpact: 1,
          projectionSampleSize: 0,
          medianProjectedDriverImpact: null,
          medianObservedDriverImpact: null,
          medianObservedOutcomeImpact: null,
          medianObservedRevenueGain: null,
          medianProjectedRevenueGain: null,
          revenueProjectionSampleSize: 0,
          revenueProjectionScale: 1,
          confidence: "low",
        },
      },
      buildExperimentStepCalibration([
        experiment({ status: "won", targetRankBefore: 10, targetRankAfter: 6 }),
      ])
    );
    assert.equal(merged?.[10]?.medianRankDelta, 4);
  });

  it("maps winning keywords to plan steps", () => {
    const map = winningExperimentStepsByKeyword([
      experiment({ status: "won", keyword: "Emergency Plumber" }),
    ]);
    assert.equal(map.get("emergency plumber"), 10);
  });
});

describe("experiment-narrative", () => {
  it("summarizes experiment outcomes", () => {
    const summary = buildExperimentPeriodSummary([
      experiment({ status: "won" }),
      experiment({ status: "lost", id: "exp-2" }),
    ]);
    assert.match(summary ?? "", /1 cell win/);
    assert.match(summary ?? "", /1 no-movement/);
  });

  it("builds a readable result narrative", () => {
    const narrative = buildExperimentResultNarrative({
      experiment: experiment({
        status: "won",
        conclusionReason: "Improved from #12 to #8 in the target cell.",
      }),
    });
    assert.match(narrative, /emergency plumber/i);
    assert.match(narrative, /Ace Plumbing/);
    assert.match(narrative, /Plan step 10/);
  });
});
