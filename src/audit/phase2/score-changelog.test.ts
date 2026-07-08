import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildScoreChangelogFromSnapshots,
  buildRankMovementsFromSnapshots,
} from "./score-changelog";
import { applyRankSnapshotsToAudit } from "./score-snapshot";
import { mergeCalibrations } from "./attribution-calibration";
import { createTestAudit } from "../phase3/test-fixtures";

describe("buildScoreChangelogFromSnapshots", () => {
  it("describes overall and component changes", () => {
    const entries = buildScoreChangelogFromSnapshots(
      {
        businessId: "b1",
        date: "2026-07-02",
        overall: 58,
        visibility: 40,
        conversion: 65,
        revenueCapture: 30,
        source: "ingest",
      },
      {
        businessId: "b1",
        date: "2026-07-01",
        overall: 53,
        visibility: 35,
        conversion: 63,
        revenueCapture: 28,
        source: "ingest",
      },
      [
        {
          keyword: "emergency plumber dallas",
          fromPosition: 8,
          toPosition: 5,
          improved: true,
        },
      ]
    );

    assert.ok(entries.some((e) => e.component === "overall" && e.delta === 5));
    assert.ok(entries.some((e) => e.component === "visibility" && e.delta === 5));
    assert.ok(entries.some((e) => e.component === "driver" && e.delta === 2));
    assert.ok(entries.some((e) => e.component === "outcome"));
    assert.ok(entries.some((e) => e.keyword === "emergency plumber dallas"));
    const rankEntry = entries.find((e) => e.keyword === "emergency plumber dallas");
    assert.ok(rankEntry?.label.includes("1 mi"));
  });

  it("adds pack fragility hint when keyword ranks are provided", () => {
    const audit = createTestAudit();
    const fragileKw = audit.rankings.keywords.find((k) => k.keyword === "plumber near me")!;
    const keywordRanks = new Map([[fragileKw.keyword, fragileKw]]);

    const entries = buildScoreChangelogFromSnapshots(
      {
        businessId: "b1",
        date: "2026-07-02",
        overall: 58,
        visibility: 40,
        conversion: 65,
        revenueCapture: 30,
        source: "ingest",
      },
      {
        businessId: "b1",
        date: "2026-07-01",
        overall: 53,
        visibility: 35,
        conversion: 63,
        revenueCapture: 28,
        source: "ingest",
      },
      [
        {
          keyword: "plumber near me",
          fromPosition: 4,
          toPosition: 3,
          improved: true,
        },
      ],
      keywordRanks
    );

    const rankEntry = entries.find((e) => e.keyword === "plumber near me");
    assert.ok(rankEntry?.label.includes("1 mi"));
    assert.match(rankEntry?.label ?? "", /pack fragile beyond 3 mi/);
  });
});

describe("applyRankSnapshotsToAudit", () => {
  it("updates rankings from daily snapshots", () => {
    const audit = createTestAudit();
    const updated = applyRankSnapshotsToAudit(audit, [
      {
        businessId: "biz",
        keyword: "emergency plumber dallas",
        date: "2026-07-02",
        distanceMiles: 1,
        gridNorth: 0,
        gridEast: 0,
        rank: 3,
        inLocalPack: true,
        localPackPosition: 3,
        source: "api",
      },
    ]);

    const kw = updated.rankings.keywords.find(
      (k) => k.keyword === "emergency plumber dallas"
    );
    assert.ok(kw?.inLocalPack);
    assert.equal(kw?.localPackPosition, 3);
    assert.ok(updated.rankings.keywordsInPack >= 2);
  });
});

describe("mergeCalibrations", () => {
  it("blends business and global step impacts", () => {
    const merged = mergeCalibrations(
      {
        3: {
          sampleSize: 3,
          medianRankDelta: 4,
          medianCallsDelta: 2,
          estimatedScoreImpact: 6,
          projectionSampleSize: 0,
          medianProjectedDriverImpact: null,
          medianObservedDriverImpact: null,
        },
      },
      {
        3: {
          sampleSize: 20,
          medianRankDelta: 3,
          medianCallsDelta: 1,
          estimatedScoreImpact: 5,
          projectionSampleSize: 8,
          medianProjectedDriverImpact: 7,
          medianObservedDriverImpact: 4,
        },
        8: {
          sampleSize: 15,
          medianRankDelta: 2,
          medianCallsDelta: 0,
          estimatedScoreImpact: 4,
          projectionSampleSize: 0,
          medianProjectedDriverImpact: null,
          medianObservedDriverImpact: null,
        },
      }
    );

    assert.ok(merged?.[3]);
    assert.ok(merged?.[8]);
    assert.ok(merged![3].estimatedScoreImpact >= 5);
  });
});

describe("buildRankMovementsFromSnapshots", () => {
  it("detects rank improvements between dates", () => {
    const movements = buildRankMovementsFromSnapshots(
      ["plumber near me"],
      new Map([["plumber near me", 2]]),
      new Map([["plumber near me", 4]])
    );
    assert.equal(movements.length, 1);
    assert.equal(movements[0].improved, true);
  });
});
