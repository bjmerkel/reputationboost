import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyCellZone,
  customerLatLngToGridCell,
  latLngToGridOffset,
  snapToNearestGridCell,
} from "@/lib/geo/customer-to-cell";
import {
  computeWeaknessScoreForCell,
  weaknessScoresForCell,
} from "@/lib/review-velocity/cell-weakness";
import { routeGeoReviewRequest } from "@/lib/review-velocity/geo-router";
import type { FullAuditPayload } from "@/audit/types";

describe("customer-to-cell", () => {
  const center = { lat: 45.0, lng: -93.0 };

  it("maps lat/lng offset to grid cell", () => {
    const customer = { lat: 45.01, lng: -92.99 };
    const offset = latLngToGridOffset(customer, center);
    assert.ok(offset.northMiles > 0);
    assert.ok(offset.eastMiles > 0);

    const cell = customerLatLngToGridCell(customer, center, 0.5);
    assert.equal(cell.gridNorth, 0.5);
    assert.equal(cell.gridEast, 0.5);
    assert.equal(cell.zoneDirection, "NE");
  });

  it("snaps to nearest grid spacing", () => {
    const cell = snapToNearestGridCell(0.62, -0.18, 0.5);
    assert.equal(cell.gridNorth, 0.5);
    assert.ok(Math.abs(cell.gridEast) < 0.001);
  });

  it("classifies compass zones", () => {
    assert.equal(classifyCellZone(1, 0), "N");
    assert.equal(classifyCellZone(0, 1), "E");
    assert.equal(classifyCellZone(0, 0), "center");
  });
});

describe("cell-weakness", () => {
  it("scores invisible cells higher than in-pack cells", () => {
    const weak = computeWeaknessScoreForCell({ rank: null, inLocalPack: false }, 40);
    const strong = computeWeaknessScoreForCell({ rank: 2, inLocalPack: true }, 5);
    assert.ok(weak > strong);
  });

  it("finds weakness scores near a target cell", () => {
    const scores = weaknessScoresForCell(
      [
        {
          keyword: "plumber",
          gridNorth: 0.5,
          gridEast: 0.5,
          zoneDirection: "NE",
          rank: 18,
          inLocalPack: false,
          reviewGap: 30,
          weaknessScore: 80,
        },
      ],
      0.52,
      0.48
    );
    assert.equal(scores.length, 1);
    assert.equal(scores[0].keyword, "plumber");
  });
});

function minimalAudit(): FullAuditPayload {
  return {
    clientName: "Acme Plumbing",
    gbp: {
      engagement: { reviewCount: 40, averageRating: 4.8, responseRate: 0.9 },
      identity: {
        address: "123 Main, Maple Grove, MN",
        primaryCategory: "Plumber",
        phone: "",
        secondaryCategories: [],
      },
      completeness: {},
      content: {},
      performance: {},
    },
    rankings: {
      keywords: [],
      keywordsInPack: 0,
      totalKeywords: 1,
      shareOfVoice: 0,
    },
    reviews: { reviews: [], sentiment: { positiveThemes: [], negativeThemes: [] } },
    strategy: {
      gbpPlan: {
        keywordRankings: [
          {
            keyword: "water heater repair maple grove",
            inLocalPack: false,
            reviewGap: 35,
            packFragile: false,
            clientReviewCount: 10,
            packLeaderReviewCount: 50,
            localPackPosition: null,
          },
        ],
      },
    },
  } as unknown as FullAuditPayload;
}

describe("geo-router", () => {
  it("routes to the weakest matching keyword for the customer cell", () => {
    const decision = routeGeoReviewRequest({
      audit: minimalAudit(),
      customer: {
        service_notes: "water heater repair",
        service_city: "Maple Grove",
        grid_north: 0.5,
        grid_east: 0.5,
      },
      keywordGrids: new Map([
        [
          "water heater repair maple grove",
          [
            {
              lat: 0,
              lng: 0,
              offsetNorthMiles: 0.5,
              offsetEastMiles: 0.5,
              rank: 18,
              inLocalPack: false,
            },
          ],
        ],
      ]),
      neighborhoodLabel: "Maple Grove",
      location: { city: "Maple Grove", state: "MN" },
    });

    assert.ok(decision);
    assert.equal(decision.focusKeyword, "water heater repair maple grove");
    assert.equal(decision.neighborhoodLabel, "Maple Grove");
    assert.match(decision.promptSeed, /water heater repair/i);
    assert.equal(decision.geoTargeted, true);
  });
});
