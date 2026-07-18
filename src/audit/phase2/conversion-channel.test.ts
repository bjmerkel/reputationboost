import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  resolveCategoryChannelTargets,
  resolveConversionChannelBias,
} from "./conversion-channel";

describe("resolveCategoryChannelTargets", () => {
  it("raises call targets for home-service categories", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Plumber";
    const targets = resolveCategoryChannelTargets(audit);
    assert.ok(targets.calls > targets.directions);
  });

  it("raises direction targets for retail categories", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Retail store";
    const targets = resolveCategoryChannelTargets(audit);
    assert.ok(targets.directions > targets.calls);
  });
});

describe("resolveConversionChannelBias", () => {
  it("prefers calls when directions are healthy but calls are near zero", () => {
    const audit = createTestAudit();
    audit.gbp.performance.profileViews = 500;
    audit.gbp.performance.calls = 0;
    audit.gbp.performance.directionRequests = 40;
    audit.gbp.performance.websiteClicks = 5;
    assert.equal(resolveConversionChannelBias(audit), "calls");
  });

  it("honors user-preferred conversion channel override", () => {
    const audit = createTestAudit();
    audit.gbp.performance.profileViews = 500;
    audit.gbp.performance.calls = 0;
    audit.gbp.performance.directionRequests = 40;
    assert.equal(
      resolveConversionChannelBias(audit, { preferredChannel: "website" }),
      "website"
    );
  });
});
