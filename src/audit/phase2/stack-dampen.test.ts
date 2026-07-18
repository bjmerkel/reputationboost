import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  applyConversionEngagementMutation,
  applyOutcomeMutation,
  cloneAudit,
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

function conversionFixture() {
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
  return audit;
}

describe("stacked plan projections", () => {
  it("keeps multi-step revenue below the sum of isolated step revenues", () => {
    const audit = conversionFixture();
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

  it("conversion steps use engagement revenue only (no pack-rank channel)", () => {
    const audit = conversionFixture();
    const options = { avgCustomerValue: 350 };

    for (const stepNumber of [8, 11, 13, 15]) {
      const mutated = cloneAudit(audit);
      applyOutcomeMutation(mutated, stepNumber, undefined, 0);

      assert.deepEqual(
        mutated.rankings.keywords.map((kw) => kw.bestRank),
        audit.rankings.keywords.map((kw) => kw.bestRank),
        `step ${stepNumber} should not mutate pack ranks`
      );
      assert.ok(
        mutated.gbp.performance.calls +
          mutated.gbp.performance.directionRequests +
          mutated.gbp.performance.websiteClicks >
          audit.gbp.performance.calls +
            audit.gbp.performance.directionRequests +
            audit.gbp.performance.websiteClicks,
        `step ${stepNumber} should lift engagement`
      );

      const projected = projectOutcomeScoresFromActions(
        audit,
        [{ source: "plan", id: `gbp-step-${stepNumber}` }],
        options
      );
      assert.ok((projected.revenueGain ?? 0) > 0);
    }
  });

  it("dampens conversion engagement mutations for later stack positions", () => {
    const audit = conversionFixture();
    const first = cloneAudit(audit);
    const second = cloneAudit(audit);
    applyConversionEngagementMutation(first, 8, 0);
    applyConversionEngagementMutation(second, 8, 1);

    assert.ok(first.gbp.performance.calls > second.gbp.performance.calls);
    assert.ok(
      first.gbp.performance.directionRequests > second.gbp.performance.directionRequests
    );
  });

  it("does not double-count rank + engagement when mixing step families", () => {
    const audit = conversionFixture();
    audit.gbp.performance.searchKeywords = [
      { keyword: "emergency plumber dallas", impressions: 1200, belowThreshold: false },
      { keyword: "drain cleaning dallas", impressions: 800, belowThreshold: false },
      { keyword: "plumber near me", impressions: 600, belowThreshold: false },
    ];
    const options = { avgCustomerValue: 350 };

    const rankStep = projectOutcomeScoresFromActions(
      audit,
      [{ source: "plan", id: "gbp-step-3" }],
      options
    );
    const conversionStep = projectOutcomeScoresFromActions(
      audit,
      [{ source: "plan", id: "gbp-step-8" }],
      options
    );
    const mixed = projectOutcomeScoresFromActions(
      audit,
      [
        { source: "plan", id: "gbp-step-3" },
        { source: "plan", id: "gbp-step-8" },
      ],
      options
    );

    assert.ok((rankStep.revenueGain ?? 0) > 0, "rank-family step should have CTR revenue");
    assert.ok(
      (conversionStep.revenueGain ?? 0) > 0,
      "conversion-family step should have engagement revenue"
    );
    // Mixed gain should stay at/below the sum of isolated family channels.
    assert.ok(
      (mixed.revenueGain ?? 0) <=
        (rankStep.revenueGain ?? 0) + (conversionStep.revenueGain ?? 0) + 1
    );
  });
});
