import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RankSnapshotRow, ScoreDailySnapshot } from "../types/timeseries";
import {
  buildBacktestSamples,
  evaluateBacktestMetrics,
} from "./score-backtest";

function score(
  overrides: Partial<ScoreDailySnapshot> & Pick<ScoreDailySnapshot, "date">
): ScoreDailySnapshot {
  return {
    businessId: "biz-1",
    overall: 50,
    visibility: 40,
    conversion: 60,
    revenueCapture: 30,
    source: "ingest",
    ...overrides,
  };
}

function rank(
  overrides: Partial<RankSnapshotRow> &
    Pick<RankSnapshotRow, "keyword" | "date" | "rank">
): RankSnapshotRow {
  const inPack = overrides.rank != null && overrides.rank <= 3;
  return {
    businessId: "biz-1",
    distanceMiles: 1,
    gridNorth: 0,
    gridEast: 0,
    inLocalPack: inPack,
    localPackPosition: inPack ? overrides.rank : null,
    source: "api",
    ...overrides,
  };
}

describe("buildBacktestSamples", () => {
  it("pairs score at T with rank outcome at T+horizon", () => {
    const scores = [score({ date: "2026-06-01", conversion: 55 })];
    const ranks = [
      rank({ keyword: "plumber", date: "2026-06-01", rank: 8 }),
      rank({ keyword: "plumber", date: "2026-06-29", rank: 3 }),
    ];

    const samples = buildBacktestSamples(scores, ranks, 28);
    assert.equal(samples.length, 1);
    assert.equal(samples[0].rankDelta, -5);
    assert.equal(samples[0].rankImproved, true);
    assert.equal(samples[0].enteredPack, true);
  });
});

describe("evaluateBacktestMetrics", () => {
  it("correlates higher conversion with better forward rank movement", () => {
    const samples = [
      {
        businessId: "biz-1",
        keyword: "a",
        date: "2026-06-01",
        overall: 50,
        visibility: 30,
        conversion: 80,
        revenueCapture: 20,
        rank: 8,
        inLocalPack: false,
        horizonDate: "2026-06-29",
        rankAtHorizon: 4,
        inPackAtHorizon: false,
        rankDelta: -4,
        rankImproved: true,
        enteredPack: false,
      },
      {
        businessId: "biz-1",
        keyword: "b",
        date: "2026-06-01",
        overall: 45,
        visibility: 25,
        conversion: 40,
        revenueCapture: 15,
        rank: 10,
        inLocalPack: false,
        horizonDate: "2026-06-29",
        rankAtHorizon: 12,
        inPackAtHorizon: false,
        rankDelta: 2,
        rankImproved: false,
        enteredPack: false,
      },
      {
        businessId: "biz-1",
        keyword: "c",
        date: "2026-06-01",
        overall: 55,
        visibility: 35,
        conversion: 70,
        revenueCapture: 25,
        rank: 6,
        inLocalPack: false,
        horizonDate: "2026-06-29",
        rankAtHorizon: 3,
        inPackAtHorizon: true,
        rankDelta: -3,
        rankImproved: true,
        enteredPack: true,
      },
    ];

    const metrics = evaluateBacktestMetrics(samples);
    assert.equal(metrics.sampleCount, 3);
    assert.ok(metrics.conversionRankDeltaCorrelation! < 0);
    assert.ok(metrics.visibilityRankDeltaCorrelation! > metrics.conversionRankDeltaCorrelation!);
    assert.ok(metrics.packEntryLift! > 0);
  });
});
