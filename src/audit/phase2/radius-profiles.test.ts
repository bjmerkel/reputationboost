import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "../phase3/test-fixtures";
import {
  RADIUS_PROFILE_WEIGHTS,
  resolveRadiusProfile,
  radiusWeightsForAudit,
} from "./radius-profiles";

describe("radius profiles", () => {
  it("maps preschool / learning centers to neighborhood profile", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Preschool";
    assert.equal(resolveRadiusProfile(audit), "neighborhood");
    assert.equal(radiusWeightsForAudit(audit)[5], RADIUS_PROFILE_WEIGHTS.neighborhood[5]);
  });

  it("maps restaurants to hyperlocal profile", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Restaurant";
    assert.equal(resolveRadiusProfile(audit), "hyperlocal");
  });

  it("maps plumbers to metro profile", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Plumber";
    assert.equal(resolveRadiusProfile(audit), "metro");
  });

  it("weights sum to 1 for every profile", () => {
    for (const profile of Object.values(RADIUS_PROFILE_WEIGHTS)) {
      const sum = profile[1] + profile[3] + profile[5] + profile[10];
      assert.ok(Math.abs(sum - 1) < 0.001, `expected weights to sum to 1, got ${sum}`);
    }
  });
});
