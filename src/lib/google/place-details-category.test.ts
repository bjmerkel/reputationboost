import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePrimaryCategoryLabel } from "./place-details";

describe("resolvePrimaryCategoryLabel", () => {
  it("prefers primaryTypeDisplayName over generic types", () => {
    assert.equal(
      resolvePrimaryCategoryLabel({
        primaryTypeDisplayName: "Air conditioning contractor",
        primaryType: "air_conditioning_contractor",
        types: ["general_contractor", "air_conditioning_contractor", "establishment"],
      }),
      "Air conditioning contractor"
    );
  });

  it("falls back to primaryType when display name is missing", () => {
    assert.equal(
      resolvePrimaryCategoryLabel({
        primaryType: "air_conditioning_contractor",
        types: ["general_contractor", "establishment"],
      }),
      "air conditioning contractor"
    );
  });

  it("falls back to types when primary type fields are missing", () => {
    assert.equal(
      resolvePrimaryCategoryLabel({
        types: ["plumber", "establishment"],
      }),
      "plumber"
    );
  });
});
