import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ATTRIBUTE_SUGGESTION_PREFIX, diffGoogleUpdatedAttributes, diffGoogleUpdatedLocation } from "./gbp-google-updated";

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
