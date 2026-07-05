import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeGbpPlaceActionCoverage,
  formatPlaceActionCoverageSummary,
} from "./gbp-place-actions-coverage";

describe("analyzeGbpPlaceActionCoverage", () => {
  it("marks unavailable API with zero coverage", () => {
    const coverage = analyzeGbpPlaceActionCoverage({
      links: [],
      availableTypes: [],
    });

    assert.equal(coverage.apiAvailable, false);
    assert.equal(coverage.coverageScore, 0);
    assert.equal(coverage.linkCount, 0);
    assert.ok(coverage.recommendations.some((item) => item.includes("Reconnect")));
  });

  it("scores configured links against available recommended types", () => {
    const coverage = analyzeGbpPlaceActionCoverage({
      links: [
        {
          name: "locations/1/placeActionLinks/1",
          uri: "https://example.com/book",
          placeActionType: "APPOINTMENT",
          providerType: "MERCHANT",
        },
      ],
      availableTypes: [
        { placeActionType: "APPOINTMENT", displayName: "Book appointment" },
        { placeActionType: "ONLINE_APPOINTMENT", displayName: "Book online appointment" },
        { placeActionType: "SHOP_ONLINE", displayName: "Shop online" },
      ],
      primaryCategory: "Plumber",
      probe: {
        endpoints: { links: "ok", typeMetadata: "ok" },
        partial: false,
      },
    });

    assert.equal(coverage.apiAvailable, true);
    assert.equal(coverage.hasAppointmentLink, true);
    assert.equal(coverage.merchantLinkCount, 1);
    assert.ok(coverage.coverageScore > 50);
    assert.ok(coverage.missingRecommendedTypes.includes("ONLINE_APPOINTMENT"));
  });

  it("recommends food ordering links for restaurants", () => {
    const coverage = analyzeGbpPlaceActionCoverage({
      links: [],
      availableTypes: [
        { placeActionType: "DINING_RESERVATION", displayName: "Reserve a table" },
        { placeActionType: "FOOD_ORDERING", displayName: "Order food" },
      ],
      primaryCategory: "Italian restaurant",
    });

    assert.deepEqual(coverage.missingRecommendedTypes, [
      "DINING_RESERVATION",
      "FOOD_ORDERING",
    ]);
    assert.ok(
      coverage.recommendations.some((item) => item.toLowerCase().includes("reserve"))
    );
  });

  it("flags partial API when only one endpoint works", () => {
    const coverage = analyzeGbpPlaceActionCoverage({
      links: [],
      availableTypes: [{ placeActionType: "APPOINTMENT", displayName: "Book appointment" }],
      probe: {
        endpoints: { links: "failed", typeMetadata: "ok" },
        partial: true,
      },
    });

    assert.equal(coverage.partialApi, true);
    assert.equal(coverage.apiAvailable, true);
  });
});

describe("formatPlaceActionCoverageSummary", () => {
  it("summarizes configured action types", () => {
    const summary = formatPlaceActionCoverageSummary({
      apiAvailable: true,
      partialApi: false,
      coverageScore: 80,
      linkCount: 2,
      merchantLinkCount: 2,
      configuredTypes: ["APPOINTMENT", "SHOP_ONLINE"],
      availableTypes: ["APPOINTMENT", "SHOP_ONLINE"],
      missingRecommendedTypes: [],
      hasAppointmentLink: true,
      hasOnlineAppointmentLink: false,
      hasDiningReservationLink: false,
      hasFoodOrderingLink: false,
      hasShopOnlineLink: true,
      endpoints: { links: "ok", typeMetadata: "ok" },
      recommendations: [],
    });

    assert.match(summary, /Book appointment/);
    assert.match(summary, /Shop online/);
  });
});
