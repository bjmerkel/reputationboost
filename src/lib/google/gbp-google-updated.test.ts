import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTRIBUTE_SUGGESTION_PREFIX,
  diffGoogleUpdatedAttributes,
  diffGoogleUpdatedLocation,
  isGoogleUpdateResolved,
  maskIncludesField,
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
