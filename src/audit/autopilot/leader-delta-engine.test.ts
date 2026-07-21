import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GeoGridPoint, Phase1AuditPayload } from "@/audit/types";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { classifyLosingCells, isLosingCell } from "./cell-loss-classifier";
import {
  computeLeaderDelta,
  findTopLeaderDeltaForKeyword,
  formatLeaderDeltaSummary,
  summarizeLeaderGaps,
} from "./leader-delta-engine";

function cell(
  rank: number | null,
  north = 0,
  east = 0,
  leader?: { name: string; reviews: number; placeId?: string }
): GeoGridPoint {
  return {
    lat: 32.71,
    lng: -117.16,
    offsetNorthMiles: north,
    offsetEastMiles: east,
    rank,
    inLocalPack: rank !== null && rank <= 3,
    localPack: leader
      ? [
          {
            placeId: leader.placeId ?? "leader-1",
            name: leader.name,
            position: 1,
            rating: 4.9,
            reviewCount: leader.reviews,
          },
        ]
      : [],
  };
}

describe("cell-loss-classifier", () => {
  it("flags outside-pack and not-found cells as losing", () => {
    assert.equal(isLosingCell(cell(2)), false);
    assert.equal(isLosingCell(cell(4)), true);
    assert.equal(isLosingCell(cell(null)), true);
  });

  it("prioritizes worse ranks", () => {
    const losing = classifyLosingCells([
      cell(8, 0.5, 0, { name: "Leader A", reviews: 200 }),
      cell(null, -0.5, 0, { name: "Leader B", reviews: 150 }),
      cell(2),
    ]);
    assert.equal(losing[0]!.rank, null);
    assert.equal(losing[1]!.rank, 8);
  });
});

describe("leader-delta-engine", () => {
  it("outputs exact review and service deltas against the cell leader", () => {
    const delta = computeLeaderDelta({
      keyword: "emergency plumber",
      cell: cell(9, 0.5, -0.3, {
        name: "Joe's Plumbing",
        reviews: 247,
        placeId: "joe",
      }),
      client: {
        primaryCategory: "Plumber",
        secondaryCategories: [],
        reviewCount: 89,
        reviewVelocity30d: 2,
        rating: 4.7,
        photoCount: 11,
        photoRecencyDays: 45,
        postCadenceDays: 30,
        postsLast30Days: 1,
        services: ["drain cleaning"],
        attributeCount: 4,
        descriptionLength: 220,
      },
      leaderProfile: {
        name: "Joe's Plumbing",
        placeId: "joe",
        averageRating: 4.9,
        reviewCount: 247,
        newReviewsThisMonth: 12,
        postsLast30Days: 4,
        photoCount: 34,
        lastPostDate: new Date(Date.now() - 4 * 86400000).toISOString(),
        primaryCategory: "Plumber",
        descriptionLength: 640,
        attributeCount: 9,
        mapPositions: {},
        reviewThemes: [],
      },
      missingServices: ["water heater repair"],
    });

    assert.ok(delta);
    assert.equal(delta!.dimensions.reviewCount.gap, 158);
    assert.equal(delta!.dimensions.reviewCount.leader, 247);
    assert.ok(
      delta!.rankedActions.some((action) => action.hypothesis.includes("247"))
    );
    assert.ok(
      delta!.rankedActions.some((action) =>
        action.hypothesis.toLowerCase().includes("water heater repair")
      )
    );
  });

  it("summarizes leader gaps with specific values", () => {
    const delta = computeLeaderDelta({
      keyword: "plumber",
      cell: cell(11, 0, 0.5, { name: "ABC Drain", reviews: 300 }),
      client: {
        primaryCategory: "Contractor",
        secondaryCategories: [],
        reviewCount: 40,
        reviewVelocity30d: 1,
        rating: 4.5,
        photoCount: 5,
        photoRecencyDays: 60,
        postCadenceDays: 40,
        postsLast30Days: 0,
        services: [],
        attributeCount: 2,
        descriptionLength: 100,
      },
      leaderProfile: {
        name: "ABC Drain",
        placeId: "abc",
        averageRating: 4.9,
        reviewCount: 300,
        newReviewsThisMonth: 14,
        postsLast30Days: 3,
        photoCount: 40,
        lastPostDate: new Date(Date.now() - 7 * 86400000).toISOString(),
        primaryCategory: "Plumber",
        descriptionLength: 500,
        attributeCount: 8,
        mapPositions: {},
        reviewThemes: [],
      },
    });

    assert.ok(delta);
    const lines = summarizeLeaderGaps(delta!);
    assert.ok(lines.some((line) => line.includes("300")));
    assert.ok(lines.some((line) => line.includes("Category")));
    assert.ok(formatLeaderDeltaSummary(delta!).includes("ABC Drain"));
  });

  it("finds a top losing-cell delta from audit geo grids", () => {
    const audit = createTestAudit() as Phase1AuditPayload;
    const keyword = audit.rankings.keywords[0]!.keyword;
    const grid = audit.rankings.keywords[0]!.geoGrid;
    if (!grid?.length) return;

    const patched = audit.rankings.keywords.map((row) =>
      row.keyword === keyword
        ? {
            ...row,
            inLocalPack: false,
            geoGrid: grid.map((point, index) =>
              index === 0
                ? cell(12, point.offsetNorthMiles, point.offsetEastMiles, {
                    name: "Market Leader Co",
                    reviews: 400,
                    placeId: "market-leader",
                  })
                : point
            ),
          }
        : row
    );

    const delta = findTopLeaderDeltaForKeyword(
      { ...audit, rankings: { ...audit.rankings, keywords: patched } },
      keyword
    );
    assert.ok(delta);
    assert.equal(delta!.leaderName, "Market Leader Co");
  });
});
