import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { businessRecordToSummary } from "./active-business";
import { withBusinessId } from "./active-business-shared";
import type { BusinessRecord } from "@/audit/businesses";

describe("active-business helpers", () => {
  it("builds business summaries from records", () => {
    const summary = businessRecordToSummary({
      id: "biz-1",
      slug: "downtown-austin",
      name: "Downtown Austin",
      location: { address: "1 Main", city: "Austin", state: "TX", zip: "78701", lat: 0, lng: 0 },
      onboarding_complete: true,
      gbp_location_id: "loc-1",
    } as BusinessRecord);

    assert.equal(summary.id, "biz-1");
    assert.equal(summary.city, "Austin");
    assert.equal(summary.onboardingComplete, true);
    assert.equal(summary.gbpConnected, true);
  });

  it("appends businessId to platform paths", () => {
    assert.equal(
      withBusinessId("/platform/audit", "biz-1"),
      "/platform/audit?businessId=biz-1"
    );
    assert.equal(
      withBusinessId("/platform/settings?tab=gbp", "biz-1"),
      "/platform/settings?tab=gbp&businessId=biz-1"
    );
  });
});
