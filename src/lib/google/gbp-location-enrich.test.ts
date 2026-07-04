import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpLocationProfile } from "./gbp-location";
import { enrichGbpLocationProfile } from "./gbp-location";

describe("enrichGbpLocationProfile", () => {
  it("resolves structured service type ids to display names", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("categories:batchGet")) {
        return new Response(
          JSON.stringify({
            categories: [
              {
                name: "categories/gcid:plumber",
                displayName: "Plumber",
                serviceTypes: [
                  {
                    serviceTypeId: "job_type_id:drain_cleaning",
                    displayName: "Drain cleaning",
                  },
                ],
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as typeof fetch;

    const profile: GbpLocationProfile = {
      locationName: "locations/1",
      title: "Test Plumbing",
      description: "",
      phone: "",
      additionalPhones: [],
      website: "",
      address: "",
      placeId: "",
      mapsUri: "",
      primaryCategory: {
        name: "categories/gcid:plumber",
        displayName: "Plumber",
      },
      additionalCategories: [],
      serviceItems: [
        {
          name: "job_type_id:drain_cleaning",
          description: "Fast drain clearing",
          raw: {
            structuredServiceItem: {
              serviceTypeId: "job_type_id:drain_cleaning",
              description: "Fast drain clearing",
            },
          },
        },
      ],
      attributes: [],
      attributeDetails: [],
      hasRegularHours: false,
      hasFullWeekHours: false,
      hasMoreHours: false,
      hasSpecialHours: false,
      hasGoogleUpdated: false,
      hasPendingEdits: false,
      canModifyServiceList: true,
      regularHours: null,
      specialHours: null,
    };

    try {
      const enriched = await enrichGbpLocationProfile(
        {
          businessId: "b1",
          accountId: "a1",
          locationId: "1",
          accessToken: "fake-token",
          refreshToken: "refresh",
          expiresAt: new Date().toISOString(),
        },
        profile
      );

      assert.equal(enriched.serviceItems[0].name, "Drain cleaning");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
