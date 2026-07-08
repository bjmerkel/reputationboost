import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePrimaryCategoryLabel } from "./place-details";

describe("fetchPlaceCategoryLabel", () => {
  it("resolves Wayne-style HVAC listings from Places types", () => {
    const industry = resolvePrimaryCategoryLabel({
      primaryTypeDisplayName: "General contractor",
      primaryType: "general_contractor",
      types: [
        "general_contractor",
        "air_conditioning_contractor",
        "hvac_contractor",
        "establishment",
      ],
    });

    assert.equal(industry, "Air conditioning contractor");
  });
});
