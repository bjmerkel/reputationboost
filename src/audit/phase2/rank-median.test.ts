import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RankSnapshotRow } from "../types/timeseries";
import {
  DEFAULT_RANK_MEDIAN_WINDOW_DAYS,
  medianOf,
  medianRankSnapshotForKeyword,
  smoothRankSnapshotsForDate,
} from "./rank-median";

function snap(
  overrides: Partial<RankSnapshotRow> & Pick<RankSnapshotRow, "keyword" | "date" | "rank">
): RankSnapshotRow {
  return {
    businessId: "biz-1",
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

describe("medianOf", () => {
  it("returns median for odd and even counts", () => {
    assert.equal(medianOf([8, 4, 6]), 6);
    assert.equal(medianOf([8, 4, 6, 10]), 7);
  });

  it("returns null for empty input", () => {
    assert.equal(medianOf([]), null);
  });
});

describe("medianRankSnapshotForKeyword", () => {
  it("smooths noisy daily ranks with a rolling median", () => {
    const snapshots: RankSnapshotRow[] = [
      snap({ keyword: "plumber", date: "2026-07-01", rank: 8 }),
      snap({ keyword: "plumber", date: "2026-07-02", rank: 3 }),
      snap({ keyword: "plumber", date: "2026-07-03", rank: 9 }),
      snap({ keyword: "plumber", date: "2026-07-04", rank: 4 }),
      snap({ keyword: "plumber", date: "2026-07-05", rank: 5 }),
      snap({ keyword: "plumber", date: "2026-07-06", rank: 6 }),
      snap({ keyword: "plumber", date: "2026-07-07", rank: 7 }),
    ];

    const smoothed = medianRankSnapshotForKeyword(
      snapshots,
      "plumber",
      "2026-07-07",
      DEFAULT_RANK_MEDIAN_WINDOW_DAYS
    );

    assert.ok(smoothed);
    assert.equal(smoothed.rank, 6);
    assert.equal(smoothed.inLocalPack, false);
  });

  it("marks in-pack when median rank is within top 3", () => {
    const snapshots: RankSnapshotRow[] = [
      snap({ keyword: "plumber", date: "2026-07-05", rank: 2 }),
      snap({ keyword: "plumber", date: "2026-07-06", rank: 3 }),
      snap({ keyword: "plumber", date: "2026-07-07", rank: 4 }),
    ];

    const smoothed = medianRankSnapshotForKeyword(
      snapshots,
      "plumber",
      "2026-07-07",
      3
    );

    assert.ok(smoothed);
    assert.equal(smoothed.rank, 3);
    assert.equal(smoothed.inLocalPack, true);
    assert.equal(smoothed.localPackPosition, 3);
  });
});

describe("smoothRankSnapshotsForDate", () => {
  it("returns one smoothed row per keyword at 1 mi", () => {
    const snapshots: RankSnapshotRow[] = [
      snap({ keyword: "plumber", date: "2026-07-07", rank: 5 }),
      snap({ keyword: "drain cleaning", date: "2026-07-07", rank: 11 }),
    ];

    const rows = smoothRankSnapshotsForDate(
      snapshots,
      "2026-07-07",
      ["plumber", "drain cleaning"],
      DEFAULT_RANK_MEDIAN_WINDOW_DAYS,
      { multiRadius: false }
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0].keyword, "plumber");
    assert.equal(rows[1].keyword, "drain cleaning");
  });

  it("smooths each search radius when multiRadius is enabled", () => {
    const snapshots: RankSnapshotRow[] = [
      snap({ keyword: "plumber", date: "2026-07-05", rank: 2, distanceMiles: 1 }),
      snap({ keyword: "plumber", date: "2026-07-06", rank: 3, distanceMiles: 1 }),
      snap({ keyword: "plumber", date: "2026-07-07", rank: 2, distanceMiles: 1 }),
      snap({ keyword: "plumber", date: "2026-07-05", rank: 8, distanceMiles: 5 }),
      snap({ keyword: "plumber", date: "2026-07-06", rank: 9, distanceMiles: 5 }),
      snap({ keyword: "plumber", date: "2026-07-07", rank: 7, distanceMiles: 5 }),
    ];

    const rows = smoothRankSnapshotsForDate(
      snapshots,
      "2026-07-07",
      ["plumber"],
      3,
      { multiRadius: true }
    );

    assert.equal(rows.length, 2);
    const oneMi = rows.find((r) => r.distanceMiles === 1);
    const fiveMi = rows.find((r) => r.distanceMiles === 5);
    assert.equal(oneMi?.rank, 2);
    assert.equal(fiveMi?.rank, 8);
    assert.equal(fiveMi?.inLocalPack, false);
  });
});
