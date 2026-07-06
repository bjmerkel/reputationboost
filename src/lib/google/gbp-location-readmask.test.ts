import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getGbpLocationProfile,
  GOOGLE_UPDATED_READ_MASK,
  LOCATION_PROFILE_READ_MASK,
} from "./gbp-location";

/**
 * Location fields from the v1 Business Information API discovery document.
 * `attributes` is intentionally absent — it is a separate resource
 * (locations/{id}/attributes), and putting it in a locations.get readMask
 * makes Google return 400 INVALID_ARGUMENT for the entire request.
 */
const VALID_LOCATION_FIELDS = new Set([
  "adWordsLocationExtensions",
  "categories",
  "labels",
  "languageCode",
  "latlng",
  "metadata",
  "moreHours",
  "name",
  "openInfo",
  "phoneNumbers",
  "profile",
  "regularHours",
  "relationshipData",
  "serviceArea",
  "serviceItems",
  "specialHours",
  "storeCode",
  "storefrontAddress",
  "title",
  "websiteUri",
]);

const connection = {
  businessId: "b1",
  accountId: "a1",
  locationId: "123",
  accessToken: "fake-token",
  refreshToken: "refresh",
  expiresAt: new Date().toISOString(),
};

describe("locations.get readMask", () => {
  it("only requests fields that exist on the v1 Location resource", () => {
    for (const field of LOCATION_PROFILE_READ_MASK) {
      assert.ok(
        VALID_LOCATION_FIELDS.has(field),
        `"${field}" is not a valid Location field — Google rejects the whole readMask with INVALID_ARGUMENT`
      );
    }
  });

  it("does not request the attributes field", () => {
    assert.ok(!LOCATION_PROFILE_READ_MASK.includes("attributes" as never));
  });

  it("getGoogleUpdated readMask only uses valid Location fields", () => {
    for (const field of GOOGLE_UPDATED_READ_MASK.split(",")) {
      assert.ok(
        VALID_LOCATION_FIELDS.has(field),
        `"${field}" is not a valid Location field for getGoogleUpdated`
      );
    }
  });

  it("sends a valid readMask on the wire and parses the profile", async () => {
    const originalFetch = globalThis.fetch;
    let requestedMask = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requestedMask = url.searchParams.get("readMask") ?? "";
      return new Response(
        JSON.stringify({
          name: "locations/123",
          title: "Test Business",
          profile: { description: "A fine business." },
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    try {
      const profile = await getGbpLocationProfile(connection);
      assert.equal(profile.description, "A fine business.");
      const fields = requestedMask.split(",");
      for (const field of fields) {
        assert.ok(
          VALID_LOCATION_FIELDS.has(field),
          `readMask sent to Google contains invalid field "${field}"`
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rewrites Google's generic invalid-argument message into something actionable", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: { code: 400, message: "Request contains an invalid argument.", status: "INVALID_ARGUMENT" },
        }),
        { status: 400 }
      )) as typeof fetch;

    try {
      await assert.rejects(
        () => getGbpLocationProfile(connection),
        (error: Error) => {
          assert.notEqual(error.message, "Request contains an invalid argument.");
          assert.match(error.message, /INVALID_ARGUMENT/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
