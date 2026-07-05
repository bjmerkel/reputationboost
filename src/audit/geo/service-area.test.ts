import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serviceAreaFromGrid } from "@/audit/geo/service-area";
import type { GeoGridPoint } from "@/audit/types";

const CENTER = { lat: 40.0, lng: -75.0 };

function cell(north: number, east: number): GeoGridPoint {
  return {
    lat: CENTER.lat + north / 69,
    lng: CENTER.lng + east / 69,
    offsetNorthMiles: north,
    offsetEastMiles: east,
    rank: 1,
    inLocalPack: true,
  };
}

describe("serviceAreaFromGrid", () => {
  it("returns null for empty grid", () => {
    assert.equal(serviceAreaFromGrid(CENTER, []), null);
  });

  it("builds a four-corner ring from grid extents", () => {
    const grid = [cell(-1, -1), cell(-1, 1), cell(1, 1), cell(1, -1), cell(0, 0)];
    const bounds = serviceAreaFromGrid(CENTER, grid);
    assert.ok(bounds);
    assert.equal(bounds.ring.length, 4);
    assert.ok(bounds.radiusMiles >= 1);
  });
});
