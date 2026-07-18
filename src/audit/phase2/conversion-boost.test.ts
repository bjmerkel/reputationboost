import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  auditNeedsConversionBoost,
  CONVERSION_PLAN_STEPS,
  isRankOutsidePackGapId,
  profileNeedsConversionWork,
  RANK_OUTSIDE_PACK_PLAN_STEPS,
} from "./conversion-boost";

describe("conversion-boost", () => {
  it("detects conversion boost from gaps and aliases profileNeedsConversionWork", () => {
    const audit = createTestAudit();
    assert.equal(auditNeedsConversionBoost(audit), false);

    audit.gbp.performance.profileViews = 400;
    audit.gbp.performance.calls = 0;
    audit.gbp.performance.directionRequests = 0;
    audit.gbp.performance.websiteClicks = 0;
    audit.gbp.performance.coverage = {
      apiAvailable: true,
      partialApi: false,
      coverageScore: 70,
      hasCoreMetrics: true,
      hasImpressionMetrics: true,
      hasSearchKeywords: false,
      hasConversations: false,
      hasBookings: false,
      keywordCount: 0,
      trackedKeywordCount: 0,
      totalActions: 0,
      actionRate: 0,
      endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "skipped" },
      recommendations: [],
    };

    assert.equal(auditNeedsConversionBoost(audit), true);
    assert.equal(profileNeedsConversionWork(audit), true);
  });

  it("treats incomplete place-action links as conversion work", () => {
    const audit = createTestAudit();
    audit.gbp.placeActions = {
      apiAvailable: true,
      partialApi: false,
      coverageScore: 40,
      linkCount: 1,
      merchantLinkCount: 1,
      configuredTypes: ["APPOINTMENT"],
      availableTypes: ["APPOINTMENT", "SHOP_ONLINE"],
      missingRecommendedTypes: ["SHOP_ONLINE"],
      missingAvailableTypes: ["SHOP_ONLINE"],
      typeCatalog: [
        { placeActionType: "APPOINTMENT", displayName: "Book" },
        { placeActionType: "SHOP_ONLINE", displayName: "Shop" },
      ],
      hasAppointmentLink: true,
      hasOnlineAppointmentLink: false,
      hasDiningReservationLink: false,
      hasFoodOrderingLink: false,
      hasShopOnlineLink: false,
      endpoints: { links: "ok", typeMetadata: "ok" },
      recommendations: [],
    };

    assert.equal(auditNeedsConversionBoost(audit), true);
  });

  it("exports shared conversion and rank-outside-pack step lists", () => {
    assert.deepEqual([...CONVERSION_PLAN_STEPS], [8, 11, 13, 15]);
    assert.deepEqual([...RANK_OUTSIDE_PACK_PLAN_STEPS], [3, 4, 8, 10]);
    assert.equal(isRankOutsidePackGapId("rank-outside-pack-plumber"), true);
    assert.equal(isRankOutsidePackGapId("low-profile-conversions"), false);
  });
});
