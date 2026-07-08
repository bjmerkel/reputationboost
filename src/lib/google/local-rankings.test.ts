import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCompetitorTextQuery,
  competitorMapRank,
  extractCompetitors,
  isOwnBusiness,
  mergeCompetitorCandidates,
} from "./local-rankings";
import type { PlaceResult } from "./places";

function place(
  id: string,
  name: string,
  position: number,
  overrides: Partial<PlaceResult> = {}
): PlaceResult {
  return {
    placeId: id,
    name,
    rating: 4.5,
    reviewCount: 10,
    address: "123 Main St",
    types: ["establishment"],
    position,
    ...overrides,
  };
}

describe("buildCompetitorTextQuery", () => {
  it("appends city/state when keyword does not mention the city", () => {
    assert.equal(
      buildCompetitorTextQuery("car stereo installer", "Arlington, Virginia"),
      "car stereo installer in Arlington, Virginia"
    );
  });

  it("skips redundant location when keyword already includes the city", () => {
    assert.equal(
      buildCompetitorTextQuery("best car electronics shop arlington", "Arlington, Virginia"),
      "best car electronics shop arlington"
    );
  });

  it("returns keyword unchanged when no location label is provided", () => {
    assert.equal(buildCompetitorTextQuery("car audio shop"), "car audio shop");
  });
});

describe("competitor harvesting", () => {
  const matchOptions = { businessName: "Northshore Learning Center" };

  it("extractCompetitors preserves Google positions after filtering own business", () => {
    const results = [
      place("own", "Northshore Learning Center", 1),
      place("c2", "Ms. Mel's Preschool", 2),
      place("c3", "Meadows Kids Academy", 3),
    ];

    const competitors = extractCompetitors(results, matchOptions, 5);
    assert.equal(competitors.length, 2);
    assert.equal(competitors[0].name, "Ms. Mel's Preschool");
    assert.equal(competitors[0].position, 2);
    assert.equal(competitors[1].position, 3);
  });

  it("mergeCompetitorCandidates keeps source positions instead of renumbering", () => {
    const existing = [place("c2", "Competitor B", 2)];
    const incoming = [place("c4", "Competitor D", 4), place("own", "Northshore Learning Center", 1)];

    const merged = mergeCompetitorCandidates(existing, incoming, matchOptions, 5);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].position, 2);
    assert.equal(merged[1].position, 4);
  });

  it("competitorMapRank returns stored Google position", () => {
    const rank = competitorMapRank({ "preschool near me": 2 }, "preschool near me", 0);
    assert.equal(rank, 2);
  });

  it("competitorMapRank falls back to list index for legacy snapshots", () => {
    const rank = competitorMapRank({ "preschool near me": "not_in_pack" }, "preschool near me", 0);
    assert.equal(rank, 1);
  });

  it("isOwnBusiness matches normalized business names", () => {
    assert.equal(
      isOwnBusiness(place("own", "Northshore Learning Center", 1), matchOptions),
      true
    );
    assert.equal(isOwnBusiness(place("c2", "Ms. Mel's Preschool", 2), matchOptions), false);
  });
});
