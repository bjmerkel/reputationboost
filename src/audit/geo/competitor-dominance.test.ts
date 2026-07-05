import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GeoGridPoint } from "@/audit/types";
import {
  analyzeCompetitorDominance,
  cellDominanceLabel,
  topCompetitorThreat,
} from "@/audit/geo/competitor-dominance";

function cell(
  rank: number | null,
  leader?: { name: string; reviews: number; placeId?: string }
): GeoGridPoint {
  return {
    lat: 32.71,
    lng: -117.16,
    offsetNorthMiles: 0,
    offsetEastMiles: 0,
    rank,
    inLocalPack: rank !== null && rank <= 3,
    localPack: leader
      ? [
          {
            placeId: leader.placeId ?? "p1",
            name: leader.name,
            position: 1,
            rating: 4.9,
            reviewCount: leader.reviews,
          },
        ]
      : [],
  };
}

describe("competitor-dominance", () => {
  it("ranks competitors by weak cells owned", () => {
    const grid = [
      cell(12, { name: "Joe's Plumbing", reviews: 300, placeId: "joe" }),
      cell(14, { name: "Joe's Plumbing", reviews: 300, placeId: "joe" }),
      cell(8, { name: "ABC Drain", reviews: 100, placeId: "abc" }),
      cell(2),
    ];

    const dominance = analyzeCompetitorDominance(grid, 40);
    assert.equal(dominance[0]!.name, "Joe's Plumbing");
    assert.equal(dominance[0]!.weakCellsOwned, 2);
  });

  it("labels weak cells with competitor initials", () => {
    const label = cellDominanceLabel(cell(9, { name: "Joe's Plumbing", reviews: 300 }));
    assert.equal(label, "JP");
  });

  it("returns null label for in-pack cells", () => {
    assert.equal(cellDominanceLabel(cell(2)), null);
  });

  it("topCompetitorThreat returns highest threat", () => {
    const threat = topCompetitorThreat(
      [cell(11, { name: "Leader Co", reviews: 200 })],
      30
    );
    assert.ok(threat);
    assert.equal(threat!.name, "Leader Co");
    assert.ok(threat!.reviewGap >= 170);
  });
});
