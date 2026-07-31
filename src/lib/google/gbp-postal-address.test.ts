import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStorefrontAddressFromCanonical,
  parseUsPostalAddress,
} from "./gbp-postal-address";

describe("parseUsPostalAddress", () => {
  it("parses street, city, full state name, and ZIP", () => {
    const parsed = parseUsPostalAddress("2261 Southwest College Road, Ocala, Florida 34471");
    assert.deepEqual(parsed, {
      addressLines: ["2261 Southwest College Road"],
      locality: "Ocala",
      administrativeArea: "FL",
      postalCode: "34471",
      regionCode: "US",
    });
  });

  it("parses street, city, state abbreviation, and ZIP as separate segments", () => {
    const parsed = parseUsPostalAddress("2261 SW College Rd, Ocala, FL, 34471");
    assert.deepEqual(parsed, {
      addressLines: ["2261 SW College Rd"],
      locality: "Ocala",
      administrativeArea: "FL",
      postalCode: "34471",
      regionCode: "US",
    });
  });

  it("parses a standard city, state ZIP segment", () => {
    const parsed = parseUsPostalAddress("123 Main St, Las Vegas, NV 89129");
    assert.deepEqual(parsed, {
      addressLines: ["123 Main St"],
      locality: "Las Vegas",
      administrativeArea: "NV",
      postalCode: "89129",
      regionCode: "US",
    });
  });

  it("drops a trailing country segment", () => {
    const parsed = parseUsPostalAddress("123 Main St, Las Vegas, NV 89129, USA");
    assert.deepEqual(parsed, {
      addressLines: ["123 Main St"],
      locality: "Las Vegas",
      administrativeArea: "NV",
      postalCode: "89129",
      regionCode: "US",
    });
  });
});

describe("buildStorefrontAddressFromCanonical", () => {
  it("reuses existing locality metadata when parsing only updates the street line", () => {
    const built = buildStorefrontAddressFromCanonical("2261 Southwest College Road, Ocala, Florida 34471", {
      addressLines: ["2261 SW College Rd"],
      locality: "Ocala",
      administrativeArea: "FL",
      postalCode: "34471",
      regionCode: "US",
      languageCode: "en",
    });

    assert.deepEqual(built, {
      addressLines: ["2261 Southwest College Road"],
      locality: "Ocala",
      administrativeArea: "FL",
      postalCode: "34471",
      regionCode: "US",
      languageCode: "en",
    });
  });
});
