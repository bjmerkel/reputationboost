import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpLocationOption } from "./gbp-accounts";
import { enrichLocationOptions } from "./gbp-accounts";
import {
  rankGbpLocationsForBusiness,
  validateGbpLocationSelection,
} from "./gbp-onboarding-match";

describe("enrichLocationOptions", () => {
  it("returns locations unchanged when no enrichment is needed", async () => {
    const locations: GbpLocationOption[] = [
      {
        name: "locations/1",
        locationId: "1",
        accountId: "a1",
        title: "Test Shop",
        address: "1 Main St",
        phone: "",
        website: "",
        primaryCategory: "Plumber",
      },
    ];

    const enriched = await enrichLocationOptions("fake-token", locations);
    assert.equal(enriched[0].primaryCategory, "Plumber");
  });
});

describe("validateGbpLocationSelection", () => {
  const baseLocation: GbpLocationOption = {
    name: "locations/2",
    locationId: "2",
    accountId: "a1",
    title: "Other Business",
    address: "999 Elsewhere",
    phone: "",
    website: "",
    placeId: "place-wrong",
    primaryCategory: "Contractor",
  };

  it("rejects a clear placeId mismatch", async () => {
    const result = await validateGbpLocationSelection("fake-token", baseLocation, {
      name: "Dallas Pro Plumbing",
      placeId: "place-abc",
    });

    assert.equal(result.valid, false);
    assert.ok(result.warning?.includes("does not match"));
  });

  it("accepts an exact placeId match", async () => {
    const result = await validateGbpLocationSelection(
      "fake-token",
      { ...baseLocation, placeId: "place-abc" },
      {
        name: "Dallas Pro Plumbing",
        placeId: "place-abc",
      }
    );

    assert.equal(result.valid, true);
    assert.equal(result.matchScore, 100);
  });
});

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

describe("rankGbpLocationsForBusiness chain boost", () => {
  it("boosts locations that belong to a matched chain", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("googleLocations:search")) {
        return new Response(JSON.stringify({ googleLocations: [] }), { status: 200 });
      }
      if (url.includes("chains:search")) {
        return new Response(
          JSON.stringify({
            chains: [
              {
                name: "chains/walmart",
                chainNames: [{ displayName: "Walmart", languageCode: "en" }],
                locationCount: 4000,
              },
            ],
          }),
          { status: 200 }
        );
      }
      return originalFetch(input);
    }) as typeof fetch;

    try {
      const ranked = await rankGbpLocationsForBusiness(
        "fake-token",
        [
          {
            name: "locations/1",
            locationId: "1",
            accountId: "a1",
            title: "Walmart Supercenter #1234",
            address: "100 Retail Rd",
            phone: "",
            website: "",
            primaryCategory: "Department store",
            parentChainId: "chains/walmart",
            chainDisplayName: "Walmart",
          },
        ],
        { name: "Walmart" }
      );

      assert.equal(ranked[0].matchScore, 75);
      assert.match(ranked[0].matchReason ?? "", /Walmart/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
