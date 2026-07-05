import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GeoGridPoint } from "@/audit/types";
import { analyzeGeoZones, weakZones } from "@/audit/geo/zone-analyzer";
import { buildVisibilitySummary } from "@/audit/geo/visibility-summary";
import type { KeywordRankSnapshot } from "@/audit/types";

function cell(
  north: number,
  east: number,
  rank: number | null,
  inLocalPack = rank !== null && rank <= 3
): GeoGridPoint {
  return {
    lat: 32.71 + north * 0.01,
    lng: -117.16 + east * 0.01,
    offsetNorthMiles: north,
    offsetEastMiles: east,
    rank,
    inLocalPack,
  };
}

function makeGrid(cells: GeoGridPoint[]): KeywordRankSnapshot {
  return {
    keyword: "plumber austin",
    localPackPosition: 2,
    inLocalPack: true,
    geoRanks: [{ distanceMiles: 1, rank: 2, inLocalPack: true }],
    geoGrid: cells,
    packLeaderRating: 4.8,
    packLeaderReviewCount: 200,
    clientRating: 4.6,
    clientReviewCount: 40,
  };
}

describe("analyzeGeoZones", () => {
  it("classifies strong center zone when all cells in pack", () => {
    const grid = [
      cell(0, 0, 1),
      cell(0.35, 0, 2),
      cell(-0.35, 0, 1),
    ];
    const zones = analyzeGeoZones(grid);
    const center = zones.find((z) => z.direction === "center");
    assert.ok(center);
    assert.equal(center!.severity, "strong");
    assert.equal(center!.coveragePercent, 100);
  });

  it("flags critical zone when ranks are null", () => {
    const grid = [
      cell(0.7, 0.7, null, false),
      cell(0.7, 0.35, null, false),
      cell(0.35, 0.7, 15, false),
    ];
    const zones = analyzeGeoZones(grid);
    const ne = zones.find((z) => z.direction === "NE");
    assert.ok(ne);
    assert.equal(ne!.severity, "critical");
  });

  it("weakZones returns critical and weak before strong", () => {
    const grid = [
      cell(0, 0, 1),
      cell(0.7, 0, 12, false),
      cell(-0.7, 0, 14, false),
    ];
    const zones = analyzeGeoZones(grid);
    const weak = weakZones(zones);
    assert.ok(weak.length >= 1);
    assert.notEqual(weak[0]!.severity, "strong");
  });
});

describe("buildVisibilitySummary", () => {
  it("returns coverage from geoRanks when grid is absent", () => {
    const kw: KeywordRankSnapshot = {
      keyword: "test",
      localPackPosition: 2,
      inLocalPack: true,
      geoRanks: [{ distanceMiles: 1, rank: 2, inLocalPack: true }],
      packLeaderRating: 4.5,
      packLeaderReviewCount: 100,
      clientRating: 4.5,
      clientReviewCount: 20,
    };
    const summary = buildVisibilitySummary({ keywordRank: kw });
    assert.equal(summary.hasGridData, false);
    assert.equal(summary.coveragePercent, 75);
  });

  it("computes grid stats and zones when geoGrid present", () => {
    const grid = Array.from({ length: 25 }, (_, i) => {
      const row = Math.floor(i / 5) - 2;
      const col = (i % 5) - 2;
      const rank = row <= 0 ? 2 : 12;
      return cell(row * 0.35, col * 0.35, rank, rank <= 3);
    });
    const summary = buildVisibilitySummary({
      keywordRank: makeGrid(grid),
      avgCustomerValue: 500,
      searchKeywords: [{ keyword: "plumber austin", impressions: 1000 }],
    });
    assert.equal(summary.hasGridData, true);
    assert.equal(summary.cellsTotal, 25);
    assert.ok(summary.cellsInPack > 0);
    assert.ok(summary.zones.length > 0);
  });
});
