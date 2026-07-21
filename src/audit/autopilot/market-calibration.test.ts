import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMarketCalibrationFromExperiments,
  buildMarketCalibrationIndex,
  mergeMarketCalibrations,
  marketCalibrationToStepCalibration,
  rankImprovementFromDelta,
  resolveMarketActionPrior,
} from "./market-calibration";

describe("market-calibration", () => {
  it("derives rank improvement from negative rank delta", () => {
    assert.equal(rankImprovementFromDelta(-2), 2);
    assert.equal(rankImprovementFromDelta(1), 0);
    assert.equal(rankImprovementFromDelta(null), null);
  });

  it("aggregates experiment outcomes by market and action", () => {
    const rows = buildMarketCalibrationFromExperiments([
      {
        marketKey: "plumber|TX|dallas",
        actionType: "review_request",
        planStepNumber: 10,
        status: "won",
        targetRankBefore: 8,
        targetRankAfter: 4,
        targetCellRankDelta: -4,
      },
      {
        marketKey: "plumber|TX|dallas",
        actionType: "review_request",
        planStepNumber: 10,
        status: "lost",
        targetRankBefore: 6,
        targetRankAfter: 7,
        targetCellRankDelta: 1,
      },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.sampleSize, 2);
    assert.equal(rows[0]!.winRate, 0.5);
    assert.equal(rows[0]!.medianTargetCellRankDelta, -1.5);
    assert.equal(rows[0]!.medianRankImprovement, 2);
  });

  it("resolves market priors with metro → state → category fallback", () => {
    const index = buildMarketCalibrationIndex([
      {
        marketKey: "plumber|TX|dallas",
        actionType: "review_request",
        planStepNumber: 10,
        sampleSize: 1,
        medianTargetCellRankDelta: -3,
        medianRankImprovement: 3,
        winRate: 1,
        confidence: "low",
      },
      {
        marketKey: "plumber|TX",
        actionType: "review_request",
        planStepNumber: 10,
        sampleSize: 4,
        medianTargetCellRankDelta: -2,
        medianRankImprovement: 2,
        winRate: 0.75,
        confidence: "medium",
      },
    ]);

    const metro = resolveMarketActionPrior({
      marketKey: "plumber|TX|dallas",
      actionType: "review_request",
      planStepNumber: 10,
      index,
    });
    assert.equal(metro.source, "market");
    assert.ok(metro.marketPriorRankDelta > 0);

    const stateFallback = resolveMarketActionPrior({
      marketKey: "plumber|TX|austin",
      actionType: "review_request",
      planStepNumber: 10,
      index,
    });
    assert.equal(stateFallback.source, "vertical");
    assert.equal(stateFallback.marketKeyUsed, "plumber|TX");
    assert.equal(stateFallback.marketPriorRankDelta, 2);
  });

  it("converts market rows into step calibration and merges with base", () => {
    const market = marketCalibrationToStepCalibration([
      {
        marketKey: "plumber|TX|dallas",
        actionType: "review_request",
        planStepNumber: 10,
        sampleSize: 3,
        medianTargetCellRankDelta: -2,
        medianRankImprovement: 2,
        winRate: 0.67,
        confidence: "medium",
      },
    ]);

    assert.equal(market[10]?.sampleSize, 3);
    assert.equal(market[10]?.medianRankDelta, 2);

    const merged = mergeMarketCalibrations(
      {
        10: {
          sampleSize: 1,
          medianRankDelta: 1,
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
      market
    );

    assert.equal(merged?.[10]?.sampleSize, 3);
    assert.equal(merged?.[10]?.medianRankDelta, 2);
  });
});
