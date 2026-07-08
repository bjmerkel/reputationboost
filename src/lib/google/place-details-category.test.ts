import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestCategoryFromTypes,
  isGenericCategoryLabel,
  resolvePrimaryCategoryLabel,
} from "./place-details";

describe("resolvePrimaryCategoryLabel", () => {
  it("prefers primaryTypeDisplayName when it is specific", () => {
    assert.equal(
      resolvePrimaryCategoryLabel({
        primaryTypeDisplayName: "Air conditioning contractor",
        primaryType: "air_conditioning_contractor",
        types: ["general_contractor", "air_conditioning_contractor", "establishment"],
      }),
      "Air conditioning contractor"
    );
  });

  it("prefers air conditioning contractor over generic general contractor primary", () => {
    assert.equal(
      resolvePrimaryCategoryLabel({
        primaryTypeDisplayName: "General contractor",
        primaryType: "general_contractor",
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
      "Air conditioning contractor"
    );
  });

  it("falls back to the most specific type when primary type fields are missing", () => {
    assert.equal(
      resolvePrimaryCategoryLabel({
        types: ["plumber", "establishment"],
      }),
      "Plumber"
    );
  });
});

describe("bestCategoryFromTypes", () => {
  it("ranks hvac-related types above general contractor", () => {
    assert.equal(
      bestCategoryFromTypes([
        "general_contractor",
        "air_conditioning_contractor",
        "establishment",
      ]),
      "Air conditioning contractor"
    );
  });
});

describe("isGenericCategoryLabel", () => {
  it("flags broad contractor labels", () => {
    assert.equal(isGenericCategoryLabel("General contractor"), true);
    assert.equal(isGenericCategoryLabel("Air conditioning contractor"), false);
  });
});
