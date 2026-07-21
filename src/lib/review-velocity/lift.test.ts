import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyLiftAggregatesToScores,
  type CellWeaknessScore,
} from "@/lib/review-velocity/cell-weakness";
import {
  adjustWeaknessScoreForLift,
  cellLiftKey,
  computeLiftScore,
  formatKeywordScope,
  parseKeywordScope,
  rankAtCell,
} from "@/lib/review-velocity/lift";
import type { GeoGridPoint } from "@/audit/types";

function sampleCell(overrides: Partial<CellWeaknessScore> = {}): CellWeaknessScore {
  return {
    keyword: "plumber",
    gridNorth: 0.5,
    gridEast: 0.5,
    zoneDirection: "NE",
    rank: 18,
    inLocalPack: false,
    reviewGap: 30,
    weaknessScore: 80,
    ...overrides,
  };
}

describe("lift scoring", () => {
  it("computes positive lift when rank improves", () => {
    const score = computeLiftScore({
      rankBefore: 18,
      rankAfter: 12,
      coverageBefore: 0,
      coverageAfter: 0,
    });
    assert.equal(score, 4.2);
  });

  it("computes negative lift when rank disappears", () => {
    const score = computeLiftScore({
      rankBefore: 8,
      rankAfter: null,
      coverageBefore: 0,
      coverageAfter: 0,
    });
    assert.equal(score, -3.5);
  });

  it("reads rank at a target cell from grid data", () => {
    const grid: GeoGridPoint[] = [
      {
        offsetNorthMiles: 0.5,
        offsetEastMiles: 0.5,
        rank: 14,
        inLocalPack: false,
        lat: 45.01,
        lng: -92.99,
      },
    ];
    const cell = rankAtCell(grid, 0.52, 0.48);
    assert.deepEqual(cell, { rank: 14, inLocalPack: false });
  });
});

describe("lift routing adjustments", () => {
  it("deprioritizes cells with strong measured lift", () => {
    const adjusted = adjustWeaknessScoreForLift(80, {
      sampleCount: 3,
      avgLiftScore: 4,
      resistanceFlag: false,
    });
    assert.equal(adjusted, 52);
  });

  it("flags review-resistant cells", () => {
    const adjusted = adjustWeaknessScoreForLift(80, {
      sampleCount: 6,
      avgLiftScore: 0.5,
      resistanceFlag: true,
    });
    assert.equal(adjusted, 44);
  });

  it("applies lift aggregates across weakness scores", () => {
    const key = cellLiftKey("plumber", 0.5, 0.5);
    const scores = applyLiftAggregatesToScores([sampleCell()], new Map([
      [key, { keyword: "plumber", gridNorth: 0.5, gridEast: 0.5, sampleCount: 3, avgLiftScore: 4, resistanceFlag: false }],
    ]));
    assert.equal(scores[0].weaknessScore, 52);
  });
});

describe("keyword scope helpers", () => {
  it("formats and parses keyword scopes", () => {
    assert.equal(formatKeywordScope("Emergency Plumber"), "keyword:Emergency Plumber");
    assert.equal(parseKeywordScope("keyword:Emergency Plumber"), "Emergency Plumber");
    assert.equal(parseKeywordScope("__all__"), null);
  });
});
