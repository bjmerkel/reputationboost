import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PerformanceDailyRow, RankSnapshotRow } from "../types/timeseries";
import {
  DEFAULT_BLEND_WEIGHTS,
  DEFAULT_CLICK_SHARE_CURVE,
  blendClickShareCurve,
  learnBlendWeights,
  learnClickShareCurve,
  buildLearnedScoreModel,
} from "./score-learning";
import { positionClickShare, resolveClickSharePercent } from "./scoring";
import type { BacktestSample } from "./score-backtest";

function rankRow(
  overrides: Partial<RankSnapshotRow> & Pick<RankSnapshotRow, "businessId" | "keyword" | "date" | "rank">
): RankSnapshotRow {
  return {
    distanceMiles: 1,
    gridNorth: 0,
    gridEast: 0,
    inLocalPack: overrides.rank != null && overrides.rank <= 3,
    localPackPosition:
      overrides.rank != null && overrides.rank <= 3 ? overrides.rank : null,
    source: "api",
    ...overrides,
  };
}

function perfRow(
  businessId: string,
  date: string,
  metric: PerformanceDailyRow["metric"],
  value: number
): PerformanceDailyRow {
  return { businessId, date, metric, value, source: "api" };
}

describe("learnClickShareCurve", () => {
  it("fits relative click share from rank-position engagement rates", () => {
    const expandedRanks: RankSnapshotRow[] = [];
    const expandedPerf: PerformanceDailyRow[] = [];

    for (let i = 0; i < 50; i++) {
      const date = `2026-06-${String((i % 28) + 1).padStart(2, "0")}`;
      const biz = `b${(i % 4) + 1}`;
      const rank = (i % 4) + 1 + (i % 3 === 0 ? 5 : 0);
      expandedRanks.push(
        rankRow({
          businessId: biz,
          keyword: `keyword-${i % 5}`,
          date,
          rank: rank > 10 ? 11 : rank,
        })
      );

      const impressions = 1000;
      const rateBase = rank <= 1 ? 0.07 : rank <= 2 ? 0.045 : rank <= 3 ? 0.03 : 0.01;
      const actions = Math.round(impressions * rateBase);
      expandedPerf.push(
        perfRow(biz, date, "impressions_maps", impressions),
        perfRow(biz, date, "calls", Math.round(actions * 0.5)),
        perfRow(biz, date, "direction_requests", Math.round(actions * 0.3)),
        perfRow(biz, date, "website_clicks", Math.round(actions * 0.2))
      );
    }

    const { curve, sampleCount } = learnClickShareCurve(expandedRanks, expandedPerf);
    assert.ok(sampleCount >= 40);
    assert.ok(curve.pack1 >= curve.pack2);
    assert.ok(curve.pack2 >= curve.pack3);
    assert.ok(curve.pack3 > curve.outsidePack);
  });

  it("returns defaults when sample size is insufficient", () => {
    const result = learnClickShareCurve([], []);
    assert.deepEqual(result.curve, DEFAULT_CLICK_SHARE_CURVE);
    assert.equal(result.sampleCount, 0);
  });
});

describe("learnBlendWeights", () => {
  it("increases conversion weight when it better predicts rank improvement", () => {
    const samples: BacktestSample[] = Array.from({ length: 40 }, (_, i) => ({
      businessId: "b1",
      keyword: `kw-${i}`,
      date: "2026-06-01",
      overall: 50,
      visibility: 30 + (i % 5),
      conversion: 40 + (i % 20),
      revenueCapture: 25,
      rank: 8,
      inLocalPack: false,
      horizonDate: "2026-06-29",
      rankAtHorizon: 8 - Math.floor((40 + (i % 20)) / 15),
      inPackAtHorizon: false,
      rankDelta: Math.floor((40 + (i % 20)) / 15) * -1,
      rankImproved: true,
      enteredPack: false,
    }));

    const { weights, sampleCount } = learnBlendWeights(samples);
    assert.equal(sampleCount, 40);
    assert.ok(weights.conversion >= DEFAULT_BLEND_WEIGHTS.conversion);
    assert.ok(
      Math.abs(weights.visibility + weights.conversion + weights.revenueCapture - 1) < 0.01
    );
  });
});

describe("positionClickShare with learned model", () => {
  it("uses learned curve when model is provided", () => {
    const learned = blendClickShareCurve(
      { pack1: 50, pack2: 28, pack3: 14, outsidePack: 4, deepOutside: 2 },
      DEFAULT_CLICK_SHARE_CURVE,
      80
    );

    assert.equal(positionClickShare(1, { clickShare: learned, clickShareSamples: 80, blendWeights: DEFAULT_BLEND_WEIGHTS, blendSamples: 0, source: "learned", updatedAt: "" }), learned.pack1);
    assert.notEqual(resolveClickSharePercent(2, learned), DEFAULT_CLICK_SHARE_CURVE.pack2);
  });
});

describe("buildLearnedScoreModel", () => {
  it("assembles click share and blend weights", () => {
    const model = buildLearnedScoreModel({ ranks: [], performance: [], scores: [] });
    assert.ok(model.clickShare.pack1 > 0);
    assert.ok(model.blendWeights.conversion > 0);
    assert.equal(model.source, "default");
  });
});
