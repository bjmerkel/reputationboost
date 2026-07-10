import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDemoGeoGrid } from "@/lib/google/geo-grid";
import { geoGridToRankRows } from "@/audit/geo/grid-coverage";
import {
  buildRadialSearchOrigins,
  isRadialRankGrid,
  summarizeRadialRanks,
} from "@/lib/google/radial-rankings";

describe("radial rank grid", () => {
  const center = { lat: 40.7128, lng: -74.006 };

  it("builds the center and eight exact bearings on each ring", () => {
    const origins = buildRadialSearchOrigins(center);

    assert.equal(origins.length, 25);
    assert.equal(origins.filter((origin) => origin.distanceMiles === 0).length, 1);
    assert.equal(origins.filter((origin) => origin.distanceMiles === 1).length, 8);
    assert.equal(origins.filter((origin) => origin.distanceMiles === 3).length, 8);
    assert.equal(origins.filter((origin) => origin.distanceMiles === 5).length, 8);

    const northeast = origins.find(
      (origin) => origin.distanceMiles === 3 && origin.direction === "NE"
    );
    assert.ok(northeast);
    assert.ok(Math.abs(northeast.offsetNorthMiles - 2.121) < 0.001);
    assert.ok(Math.abs(northeast.offsetEastMiles - 2.121) < 0.001);
  });

  it("creates a recognizable 25-point demo grid and ring summaries", () => {
    const grid = buildDemoGeoGrid(center, 2);
    const summary = summarizeRadialRanks(grid);

    assert.equal(isRadialRankGrid(grid), true);
    assert.equal(summary.centerRank, 2);
    assert.deepEqual(
      summary.rings.map((ring) => ring.sampleCount),
      [8, 8, 8]
    );
    assert.ok(
      summary.rings[2]!.rank == null ||
        (summary.rings[0]!.rank != null && summary.rings[2]!.rank >= summary.rings[0]!.rank)
    );
  });

  it("persists raw samples separately from three ring summaries", () => {
    const grid = buildDemoGeoGrid(center, 2);
    const rows = geoGridToRankRows({
      businessId: "business-1",
      keyword: "ac repair",
      date: "2026-07-10",
      geoGrid: grid,
      source: "api",
    });

    assert.equal(rows.length, 28);
    assert.equal(
      rows.filter((row) => row.distanceMiles === 0 && row.gridNorth === 0 && row.gridEast === 0)
        .length,
      1
    );
    assert.deepEqual(
      rows
        .filter((row) => row.gridNorth === 0 && row.gridEast === 0 && row.distanceMiles > 0)
        .map((row) => row.distanceMiles),
      [1, 3, 5]
    );
  });
});
