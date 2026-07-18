import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  auditNeedsConversionBoost,
  auditNeedsSoftConversionBoost,
  auditPrefersConversionOverRank,
  CONVERSION_PLAN_STEPS,
  isRankOutsidePackGapId,
  profileNeedsConversionWork,
  RANK_OUTSIDE_PACK_PLAN_STEPS,
  WEAK_PROFILE_ACTION_RATE_PCT,
} from "./conversion-boost";
import { detectGaps } from "./gaps";

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

  it("detects weak action-rate conversions (not only zero actions)", () => {
    const audit = createTestAudit();
    audit.gbp.performance.profileViews = 500;
    audit.gbp.performance.calls = 3;
    audit.gbp.performance.directionRequests = 2;
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
      totalActions: 5,
      actionRate: 1,
      endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "skipped" },
      recommendations: [],
    };

    assert.ok(1 < WEAK_PROFILE_ACTION_RATE_PCT);
    assert.equal(auditNeedsConversionBoost(audit), true);
    assert.ok(detectGaps(audit).some((gap) => gap.id === "weak-profile-conversions"));
    assert.equal(
      detectGaps(audit).some((gap) => gap.id === "low-profile-conversions"),
      false
    );
  });

  it("prefers conversion over rank when pack share is high and conversion is weak", () => {
    const audit = createTestAudit();
    audit.rankings.keywordsInPack = 3;
    audit.rankings.totalKeywords = 3;
    audit.rankings.keywords = audit.rankings.keywords.map((kw) => ({
      ...kw,
      inLocalPack: true,
      localPackPosition: 2 as const,
      geoRanks: kw.geoRanks.map((g) => ({ ...g, rank: 2, inLocalPack: true })),
    }));
    audit.gbp.performance.profileViews = 500;
    audit.gbp.performance.calls = 3;
    audit.gbp.performance.directionRequests = 2;
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
      totalActions: 5,
      actionRate: 1,
      endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "skipped" },
      recommendations: [],
    };

    assert.equal(auditPrefersConversionOverRank(audit), true);
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

  it("detects soft conversion tier at 40–99 views with P1 gaps", () => {
    const audit = createTestAudit();
    audit.gbp.performance.profileViews = 60;
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
    assert.equal(auditNeedsSoftConversionBoost(audit), true);
    assert.equal(auditPrefersConversionOverRank(audit), false);

    const conversionGaps = detectGaps(audit).filter(
      (gap) =>
        gap.id === "low-profile-conversions" || gap.id === "weak-profile-conversions"
    );
    assert.ok(conversionGaps.length > 0);
    assert.ok(conversionGaps.every((gap) => gap.priority === "P1"));
  });
});
