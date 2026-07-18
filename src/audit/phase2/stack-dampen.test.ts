import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  projectOutcomeScoresFromActions,
  stackDampeningFactor,
} from "./counterfactual";

describe("stackDampeningFactor", () => {
  it("decays later stacked actions", () => {
    assert.equal(stackDampeningFactor(0), 1);
    assert.equal(stackDampeningFactor(1), 0.7);
    assert.equal(stackDampeningFactor(2), 0.5);
    assert.equal(stackDampeningFactor(3), 0.35);
    assert.equal(stackDampeningFactor(9), 0.35);
  });
});

describe("stacked plan projections", () => {
  it("keeps multi-step revenue below the sum of isolated step revenues", () => {
    const audit = createTestAudit();
    audit.gbp.performance.profileViews = 500;
    audit.gbp.performance.calls = 0;
    audit.gbp.performance.directionRequests = 0;
    audit.gbp.performance.websiteClicks = 0;
    audit.gbp.placeActions = {
      apiAvailable: true,
      partialApi: false,
      coverageScore: 0,
      linkCount: 0,
      merchantLinkCount: 0,
      configuredTypes: [],
      availableTypes: ["APPOINTMENT"],
      missingRecommendedTypes: ["APPOINTMENT"],
      missingAvailableTypes: ["APPOINTMENT"],
      typeCatalog: [{ placeActionType: "APPOINTMENT", displayName: "Book" }],
      hasAppointmentLink: false,
      hasOnlineAppointmentLink: false,
      hasDiningReservationLink: false,
      hasFoodOrderingLink: false,
      hasShopOnlineLink: false,
      endpoints: { links: "ok", typeMetadata: "ok" },
      recommendations: [],
    };

    const options = { avgCustomerValue: 350 };
    const step8 = projectOutcomeScoresFromActions(
      audit,
      [{ source: "plan", id: "gbp-step-8" }],
      options
    );
    const step15 = projectOutcomeScoresFromActions(
      audit,
      [{ source: "plan", id: "gbp-step-15" }],
      options
    );
    const stacked = projectOutcomeScoresFromActions(
      audit,
      [
        { source: "plan", id: "gbp-step-8" },
        { source: "plan", id: "gbp-step-15" },
      ],
      options
    );

    assert.ok((step8.revenueGain ?? 0) > 0);
    assert.ok((step15.revenueGain ?? 0) > 0);
    assert.ok((stacked.revenueGain ?? 0) > 0);
    assert.ok(
      (stacked.revenueGain ?? 0) < (step8.revenueGain ?? 0) + (step15.revenueGain ?? 0),
      "stacked conversion revenue should be dampened vs isolated sum"
    );
  });
});
