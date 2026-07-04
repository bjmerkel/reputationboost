import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lookupServiceTypeForDisplayName } from "./gbp-location";

describe("lookupServiceTypeForDisplayName", () => {
  it("matches exact and partial service type display names", async () => {
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
                  {
                    serviceTypeId: "job_type_id:water_heater_installation",
                    displayName: "Water heater installation",
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

    const connection = {
      businessId: "b1",
      accountId: "a1",
      locationId: "1",
      accessToken: "fake-token",
      refreshToken: "refresh",
      expiresAt: new Date().toISOString(),
    };

    try {
      const exact = await lookupServiceTypeForDisplayName(
        connection,
        "categories/gcid:plumber",
        "Drain cleaning"
      );
      assert.equal(exact?.serviceTypeId, "job_type_id:drain_cleaning");

      const partial = await lookupServiceTypeForDisplayName(
        connection,
        "categories/gcid:plumber",
        "water heater"
      );
      assert.equal(partial?.serviceTypeId, "job_type_id:water_heater_installation");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
