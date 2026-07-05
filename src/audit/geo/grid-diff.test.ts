import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GeoGridPoint } from "@/audit/types";
import { computeGridDiff } from "@/audit/geo/grid-diff";

function cell(north: number, east: number, rank: number | null): GeoGridPoint {
  return {
    lat: 32.71 + north * 0.01,
    lng: -117.16 + east * 0.01,
    offsetNorthMiles: north,
    offsetEastMiles: east,
    rank,
    inLocalPack: rank !== null && rank <= 3,
  };
}

describe("computeGridDiff", () => {
  it("counts improved and regressed cells", () => {
    const before = [
      cell(0, 0, 8),
      cell(0.35, 0, 12),
      cell(-0.35, 0, 2),
    ];
    const after = [
      cell(0, 0, 3),
      cell(0.35, 0, 14),
      cell(-0.35, 0, 2),
    ];

    const diff = computeGridDiff(before, after, "plumber", "2026-05-01", "2026-06-01");
    assert.equal(diff.cellsImproved, 1);
    assert.equal(diff.cellsRegressed, 1);
    assert.equal(diff.cellsUnchanged, 1);
    assert.ok(diff.coverageDelta > 0);
  });

  it("reports coverage delta", () => {
    const before = [cell(0, 0, 8), cell(0.35, 0, 12)];
    const after = [cell(0, 0, 2), cell(0.35, 0, 3)];

    const diff = computeGridDiff(before, after, "kw", "2026-01-01", "2026-02-01");
    assert.equal(diff.coverageBefore, 0);
    assert.equal(diff.coverageAfter, 100);
    assert.equal(diff.coverageDelta, 100);
    assert.equal(diff.netCellsInPack, 2);
  });
});
