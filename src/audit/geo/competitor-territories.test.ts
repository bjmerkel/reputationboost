import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCompetitorTerritories } from "@/audit/geo/competitor-territories";
import type { GeoGridPoint } from "@/audit/types";

function weakCell(
  north: number,
  east: number,
  leaderId: string,
  leaderName: string
): GeoGridPoint {
  return {
    lat: 40 + north / 69,
    lng: -75 + east / 69,
    offsetNorthMiles: north,
    offsetEastMiles: east,
    rank: 8,
    inLocalPack: false,
    localPack: [
      {
        placeId: leaderId,
        name: leaderName,
        position: 1,
        rating: 4.8,
        reviewCount: 100,
      },
    ],
  };
}

describe("buildCompetitorTerritories", () => {
  it("groups weak cells by leader and requires at least two cells", () => {
    const grid = [
      weakCell(1, 0, "a", "Alpha Co"),
      weakCell(2, 0, "a", "Alpha Co"),
      weakCell(0, 1, "b", "Beta LLC"),
    ];

    const territories = buildCompetitorTerritories(grid);
    assert.equal(territories.length, 1);
    assert.equal(territories[0]!.placeId, "a");
    assert.equal(territories[0]!.cellCount, 2);
    assert.equal(territories[0]!.ring.length, 4);
  });
});
