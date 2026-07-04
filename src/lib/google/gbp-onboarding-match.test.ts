import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpLocationOption } from "./gbp-accounts";
import { rankGbpLocationsForBusiness } from "./gbp-onboarding-match";

describe("rankGbpLocationsForBusiness", () => {
  const locations: GbpLocationOption[] = [
    {
      name: "locations/1",
      locationId: "1",
      accountId: "a1",
      title: "Dallas Pro Plumbing",
      address: "123 Main St, Dallas, TX",
      phone: "",
      website: "",
      placeId: "place-abc",
      primaryCategory: "Plumber",
    },
    {
      name: "locations/2",
      locationId: "2",
      accountId: "a1",
      title: "Other Business",
      address: "999 Elsewhere",
      phone: "",
      website: "",
      primaryCategory: "Contractor",
    },
  ];

  it("recommends exact placeId match first", async () => {
    const ranked = await rankGbpLocationsForBusiness("fake-token", locations, {
      name: "Dallas Pro Plumbing",
      placeId: "place-abc",
    });

    assert.equal(ranked[0].locationId, "1");
    assert.equal(ranked[0].matchScore, 100);
    assert.equal(ranked[0].recommended, true);
  });
});
