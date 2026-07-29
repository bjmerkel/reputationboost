import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BusinessRecord } from "@/audit/businesses";
import {
  defaultKeywordsFromGbp,
  filterUnlinkedLocations,
  getClaimedGbpLocationIds,
  listGbpTokenSources,
} from "@/lib/google/gbp-import";
import type { RankedGbpLocation } from "@/lib/google/gbp-onboarding-match";

describe("gbp-import helpers", () => {
  it("dedupes token sources by google email", () => {
    const rows = [
      {
        id: "a",
        name: "Downtown",
        gbp_google_email: "owner@example.com",
        gbp_refresh_token: "token-a",
        gbp_connected_at: "2026-01-01T00:00:00Z",
        location: { city: "Austin", state: "TX" },
      },
      {
        id: "b",
        name: "Round Rock",
        gbp_google_email: "owner@example.com",
        gbp_refresh_token: "token-b",
        gbp_connected_at: "2026-02-01T00:00:00Z",
        location: { city: "Round Rock", state: "TX" },
      },
      {
        id: "c",
        name: "Franchise",
        gbp_google_email: "franchise@example.com",
        gbp_refresh_token: "token-c",
        gbp_connected_at: "2026-02-01T00:00:00Z",
        location: { city: "Dallas", state: "TX" },
      },
    ] as BusinessRecord[];

    const sources = listGbpTokenSources(rows);
    assert.equal(sources.length, 2);
    assert.equal(sources.find((source) => source.googleEmail === "owner@example.com")?.businessId, "b");
  });

  it("filters already-claimed GBP locations", () => {
    const claimed = getClaimedGbpLocationIds(
      [{ id: "x", gbp_location_id: "loc-1" } as BusinessRecord],
      "new"
    );
    const locations = filterUnlinkedLocations(
      [
        { locationId: "loc-1", accountId: "acc", title: "Taken" },
        { locationId: "loc-2", accountId: "acc", title: "Open" },
      ] as RankedGbpLocation[],
      claimed
    );

    assert.equal(locations.length, 1);
    assert.equal(locations[0]?.locationId, "loc-2");
  });

  it("builds default keywords from GBP fields", () => {
    const keywords = defaultKeywordsFromGbp("Joe's Pizza", "pizza_restaurant", "Austin");
    assert.equal(keywords.length, 3);
    assert.match(keywords[0] ?? "", /pizza/);
  });
});
