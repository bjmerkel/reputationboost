import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTRIBUTE_SUGGESTION_PREFIX,
  diffGoogleUpdatedAttributes,
  diffGoogleUpdatedLocation,
  formatPostalAddress,
  isGoogleUpdateResolved,
  maskIncludesField,
  normalizeAddressForCompare,
  parseUpdateMask,
  pendingFieldsFromMask,
  suggestionsFromDiffMask,
} from "./gbp-google-updated";

describe("diffGoogleUpdatedLocation", () => {
  it("detects changed fields between owner and Google versions", () => {
    const owner = {
      title: "My Shop",
      profile: { description: "Old description" },
      phoneNumbers: { primaryPhone: "555-0100" },
    };
    const google = {
      title: "My Shop",
      profile: { description: "Google suggested description" },
      phoneNumbers: { primaryPhone: "555-0199" },
    };

    const diffs = diffGoogleUpdatedLocation(owner, google);
    assert.equal(diffs.length, 2);
    assert.ok(diffs.some((d) => d.field === "profile.description"));
    assert.ok(diffs.some((d) => d.field === "phoneNumbers.primaryPhone"));
    assert.equal(diffs[0].kind, "diff");
  });

  it("does not treat structured vs flattened equivalent addresses as conflicts", () => {
    const owner = {
      storefrontAddress: {
        addressLines: ["7901 West Gowan Road, Las Vegas, NV, 89129"],
      },
    };
    const google = {
      storefrontAddress: {
        regionCode: "US",
        languageCode: "en",
        postalCode: "89129",
        administrativeArea: "NV",
        locality: "Las Vegas",
        addressLines: ["7901 West Gowan Road"],
      },
    };

    const diffs = diffGoogleUpdatedLocation(owner, google);
    assert.equal(diffs.length, 0);
  });

  it("still flags a real address street change", () => {
    const owner = {
      storefrontAddress: {
        addressLines: ["100 Main St"],
        locality: "Las Vegas",
        administrativeArea: "NV",
        postalCode: "89129",
      },
    };
    const google = {
      storefrontAddress: {
        addressLines: ["200 Main St"],
        locality: "Las Vegas",
        administrativeArea: "NV",
        postalCode: "89129",
      },
    };

    const diffs = diffGoogleUpdatedLocation(owner, google);
    assert.equal(diffs.length, 1);
    assert.equal(diffs[0].field, "storefrontAddress");
  });
});

describe("diffGoogleUpdatedAttributes", () => {
  it("creates attribute suggestions with attribute field prefix", () => {
    const diffs = diffGoogleUpdatedAttributes([
      {
        name: "attributes/has_wheelchair_accessible_entrance",
        label: "Wheelchair accessible entrance",
        ownerSummary: "Wheelchair accessible entrance: disabled",
        googleSummary: "Wheelchair accessible entrance: enabled",
      },
    ]);

    assert.equal(diffs.length, 1);
    assert.equal(
      diffs[0].field,
      `${ATTRIBUTE_SUGGESTION_PREFIX}attributes/has_wheelchair_accessible_entrance`
    );
  });
});

describe("update masks", () => {
  it("parses comma-separated masks", () => {
    assert.deepEqual(parseUpdateMask("profile.description,phoneNumbers.primaryPhone"), [
      "profile.description",
      "phoneNumbers.primaryPhone",
    ]);
  });

  it("detects field membership in masks", () => {
    const mask = "profile.description,phoneNumbers.primaryPhone";
    assert.equal(maskIncludesField(mask, "profile.description"), true);
    assert.equal(maskIncludesField(mask, "title"), false);
    assert.equal(maskIncludesField("storefrontAddress.addressLines", "storefrontAddress"), true);
  });

  it("builds diff suggestions from diffMask", () => {
    const owner = { profile: { description: "Our text" } };
    const google = { profile: { description: "Google text" } };
    const suggestions = suggestionsFromDiffMask(
      owner,
      google,
      "profile.description"
    );
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].kind, "diff");
    assert.equal(suggestions[0].googleValue, "Google text");
  });

  it("formats postal addresses as human-readable values in diff suggestions", () => {
    const owner = {
      storefrontAddress: {
        addressLines: ["7901 West Gowan Road"],
        locality: "Las Vegas",
        administrativeArea: "NV",
        postalCode: "89129",
      },
    };
    const google = {
      storefrontAddress: {
        regionCode: "US",
        languageCode: "en",
        postalCode: "89101",
        administrativeArea: "NV",
        locality: "Las Vegas",
        addressLines: ["7901 West Gowan Road"],
      },
    };
    const suggestions = suggestionsFromDiffMask(owner, google, "storefrontAddress");
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].ownerValue, "7901 West Gowan Road, Las Vegas, NV 89129");
    assert.equal(suggestions[0].googleValue, "7901 West Gowan Road, Las Vegas, NV 89101");
  });

  it("builds pending suggestions from pendingMask", () => {
    const pending = pendingFieldsFromMask(
      { profile: { description: "Submitted text" } },
      "profile.description"
    );
    assert.equal(pending.length, 1);
    assert.equal(pending[0].kind, "pending");
    assert.equal(pending[0].ownerValue, "Submitted text");
  });

  it("detects resolved Google update state", () => {
    assert.equal(isGoogleUpdateResolved("", false), true);
    assert.equal(isGoogleUpdateResolved("profile.description", false), false);
    assert.equal(isGoogleUpdateResolved("", true), false);
  });
});

describe("address helpers", () => {
  it("formats and normalizes postal addresses", () => {
    const google = {
      regionCode: "US",
      languageCode: "en",
      postalCode: "89129",
      administrativeArea: "NV",
      locality: "Las Vegas",
      addressLines: ["7901 West Gowan Road"],
    };
    assert.equal(formatPostalAddress(google), "7901 West Gowan Road, Las Vegas, NV 89129");
    assert.equal(
      normalizeAddressForCompare(google),
      normalizeAddressForCompare("7901 West Gowan Road, Las Vegas, NV, 89129")
    );
  });
});
