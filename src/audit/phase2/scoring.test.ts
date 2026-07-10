import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KeywordRankSnapshot } from "../types";
import {
  computeHealthScores,
  computeConversionScore,
  computeRevenueCaptureScore,
  computeVisibilityScore,
  detectPackFragility,
  impressionWeightFloor,
  keywordGeoGridVisibilityScore,
  keywordImpressionWeight,
  keywordServiceAreaRevenueCaptureScore,
  keywordServiceAreaVisibilityScore,
  matchSearchKeywordImpressions,
  positionVisibilityScore,
} from "./scoring";
import { RADIUS_PROFILE_WEIGHTS } from "./radius-profiles";
import {
  computeOutcomeIndex,
  computeOverallFromDriverOutcome,
} from "./score-driver-outcome";
import { gapDriverScoreImpact, gapScoreImpact } from "./score-impact";
import { detectGaps } from "./gaps";
import { createTestAudit } from "../phase3/test-fixtures";

function makeGrid(inPackCount: number, total = 25): KeywordRankSnapshot["geoGrid"] {
  return Array.from({ length: total }, (_, i) => ({
    lat: 32.78,
    lng: -96.8,
    offsetNorthMiles: 0,
    offsetEastMiles: 0,
    rank: i < inPackCount ? ((i % 3) + 1) : 8,
    inLocalPack: i < inPackCount,
  }));
}

describe("positionVisibilityScore", () => {
  it("maps pack positions to visibility points", () => {
    assert.equal(positionVisibilityScore(1), 100);
    assert.equal(positionVisibilityScore(2), 75);
    assert.equal(positionVisibilityScore(3), 50);
    assert.equal(positionVisibilityScore("not_in_pack"), 0);
    assert.ok(positionVisibilityScore(4) < positionVisibilityScore(3));
    assert.ok(positionVisibilityScore(8) < positionVisibilityScore(4));
  });
});

describe("keywordImpressionWeight", () => {
  const searchKeywords = [
    { keyword: "plumber", impressions: 1200 },
    { keyword: "emergency plumber", impressions: 80 },
    { keyword: "drain cleaning", impressions: 45 },
  ];

  it("prefers exact match over substring overlap", () => {
    assert.equal(
      matchSearchKeywordImpressions("emergency plumber", searchKeywords),
      80
    );
    assert.equal(
      keywordImpressionWeight("emergency plumber", searchKeywords),
      80
    );
  });

  it("prefers longest overlapping GBP term over short generic substring", () => {
    assert.equal(
      matchSearchKeywordImpressions("emergency plumber dallas", searchKeywords),
      80
    );
    assert.notEqual(
      matchSearchKeywordImpressions("emergency plumber dallas", searchKeywords),
      1200
    );
  });

  it("uses median impression floor for unmatched keywords", () => {
    const floor = impressionWeightFloor(searchKeywords);
    assert.equal(floor, 80);
    assert.equal(keywordImpressionWeight("water heater repair dallas", searchKeywords), 80);
  });

  it("returns 1 when no GBP impression data exists", () => {
    assert.equal(impressionWeightFloor([]), 1);
    assert.equal(keywordImpressionWeight("anything", []), 1);
  });
});

describe("keywordGeoGridVisibilityScore", () => {
  it("uses share of in-pack grid points when geoGrid is present", () => {
    const kw: KeywordRankSnapshot = {
      keyword: "plumber near me",
      localPackPosition: 1,
      inLocalPack: true,
      geoRanks: [{ distanceMiles: 1, rank: 1, inLocalPack: true }],
      geoGrid: makeGrid(10, 25),
      packLeaderRating: 4.9,
      packLeaderReviewCount: 200,
      clientRating: 4.6,
      clientReviewCount: 87,
    };
    assert.equal(keywordGeoGridVisibilityScore(kw), 40);
  });

  it("falls back to 1mi rank when geoGrid is absent", () => {
    const kw: KeywordRankSnapshot = {
      keyword: "plumber near me",
      localPackPosition: 3,
      inLocalPack: true,
      geoRanks: [{ distanceMiles: 1, rank: 3, inLocalPack: true }],
      packLeaderRating: 4.9,
      packLeaderReviewCount: 200,
      clientRating: 4.6,
      clientReviewCount: 87,
    };
    assert.equal(keywordGeoGridVisibilityScore(kw), 50);
  });
});

describe("computeHealthScores", () => {
  it("returns component scores and overall blend", () => {
    const audit = createTestAudit();
    const scores = computeHealthScores(audit);

    assert.ok(scores.overall >= 0 && scores.overall <= 100);
    assert.ok(scores.driverScore >= 0 && scores.driverScore <= 100);
    assert.ok(scores.outcomeIndex >= 0 && scores.outcomeIndex <= 100);
    assert.ok(scores.visibility >= 0 && scores.visibility <= 100);
    assert.ok(scores.conversion >= 0 && scores.conversion <= 100);
    assert.ok(scores.revenueCapture >= 0 && scores.revenueCapture <= 100);
    assert.equal(scores.driverScore, scores.conversion);
    assert.equal(
      scores.outcomeIndex,
      computeOutcomeIndex(scores.visibility, scores.revenueCapture)
    );
    assert.equal(
      scores.overall,
      computeOverallFromDriverOutcome(scores.driverScore, scores.outcomeIndex)
    );
    assert.ok(scores.insight.nextAction);
    assert.ok(scores.engagementOutcomes.calls > 0);
  });

  it("weights visibility by rank depth, not just in-pack binary", () => {
    const audit = createTestAudit();
    const visibility = computeVisibilityScore(audit);
    // 1 of 3 keywords in pack at #3 — weighted visibility should be below 50
    assert.ok(visibility < 50);
    assert.ok(visibility > 0);
  });

  it("weights unmatched keywords at median impression floor", () => {
    const audit = createTestAudit();
    const withImpressions = {
      ...audit,
      gbp: {
        ...audit.gbp,
        performance: {
          ...audit.gbp.performance,
          searchKeywords: [
            { keyword: "plumber near me", impressions: 1000, belowThreshold: false },
            { keyword: "emergency plumber", impressions: 200, belowThreshold: false },
          ],
        },
      },
    };
    const withoutMatch = computeVisibilityScore(audit);
    const withMatch = computeVisibilityScore(withImpressions);
    assert.notEqual(withoutMatch, withMatch);
    // Unmatched "drain cleaning dallas" now contributes at median floor (600), not weight 1
    assert.ok(withMatch < 50);
  });

  it("uses geo-grid share for visibility when grid data is present", () => {
    const audit = createTestAudit();
    const withGrid = {
      ...audit,
      rankings: {
        ...audit.rankings,
        keywords: audit.rankings.keywords.map((kw) =>
          kw.keyword === "plumber near me"
            ? { ...kw, geoGrid: makeGrid(5, 25) }
            : kw
        ),
      },
    };
    const base = computeVisibilityScore(audit);
    const grid = computeVisibilityScore(withGrid);
    // #3 at center (50 pts) vs 5/25 grid points in pack (20 pts) — visibility should drop
    assert.ok(grid < base);
    assert.equal(keywordGeoGridVisibilityScore(withGrid.rankings.keywords[1]!), 20);
  });

  it("does not use engagement volume as a score input", () => {
    const audit = createTestAudit();
    const base = computeHealthScores(audit);
    const inflated = computeHealthScores({
      ...audit,
      gbp: {
        ...audit.gbp,
        performance: {
          ...audit.gbp.performance,
          calls: 9999,
          directionRequests: 9999,
          websiteClicks: 9999,
          profileViews: 99999,
        },
      },
    });
    assert.equal(base.overall, inflated.overall);
    assert.ok(inflated.engagementOutcomes.calls === 9999);
  });

  it("adjusts visibility from performance coverage quality", () => {
    const audit = createTestAudit();
    const withoutCoverage = computeVisibilityScore(audit);
    const withHighCoverage = computeVisibilityScore({
      ...audit,
      gbp: {
        ...audit.gbp,
        performance: {
          ...audit.gbp.performance,
          coverage: {
            apiAvailable: true,
            partialApi: false,
            coverageScore: 100,
            hasCoreMetrics: true,
            hasImpressionMetrics: true,
            hasSearchKeywords: true,
            hasConversations: false,
            hasBookings: false,
            keywordCount: 3,
            trackedKeywordCount: 3,
            totalActions: 161,
            actionRate: 39.3,
            endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "ok" },
            recommendations: [],
          },
        },
      },
    });
    const withMissingKeywords = computeVisibilityScore({
      ...audit,
      gbp: {
        ...audit.gbp,
        performance: {
          ...audit.gbp.performance,
          coverage: {
            apiAvailable: true,
            partialApi: false,
            coverageScore: 60,
            hasCoreMetrics: true,
            hasImpressionMetrics: true,
            hasSearchKeywords: false,
            hasConversations: false,
            hasBookings: false,
            keywordCount: 0,
            trackedKeywordCount: 0,
            totalActions: 161,
            actionRate: 39.3,
            endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "error" },
            recommendations: [],
          },
        },
      },
    });
    assert.ok(withHighCoverage > withoutCoverage);
    assert.ok(withMissingKeywords < withHighCoverage);
  });

  it("factors API coverage into conversion score", () => {
    const audit = createTestAudit();
    const base = computeConversionScore(audit);
    const improved = computeConversionScore({
      ...audit,
      gbp: {
        ...audit.gbp,
        placeActions: {
          apiAvailable: true,
          partialApi: false,
          coverageScore: 100,
          linkCount: 2,
          merchantLinkCount: 2,
          configuredTypes: ["APPOINTMENT", "ONLINE_APPOINTMENT"],
          availableTypes: ["APPOINTMENT", "ONLINE_APPOINTMENT"],
          missingRecommendedTypes: [],
          missingAvailableTypes: [],
          typeCatalog: [],
          hasAppointmentLink: true,
          hasOnlineAppointmentLink: true,
          hasDiningReservationLink: false,
          hasFoodOrderingLink: false,
          hasShopOnlineLink: false,
          endpoints: { links: "ok", typeMetadata: "ok" },
          recommendations: [],
        },
        localPosts: {
          apiAvailable: true,
          partialApi: false,
          coverageScore: 90,
          postCount: 4,
          livePostCount: 4,
          rejectedPostCount: 0,
          processingPostCount: 0,
          postsLast30Days: 2,
          daysSinceLastPost: 5,
          topicTypesUsed: ["STANDARD"],
          hasOfferPost: false,
          hasEventPost: false,
          hasCallToActionPosts: true,
          hasMediaPosts: true,
          totalViews: 120,
          endpoints: { list: "ok", insights: "ok" },
          recommendations: [],
        },
        reviewCoverage: {
          apiAvailable: true,
          partialApi: false,
          coverageScore: 95,
          reviewCount: 87,
          averageRating: 4.6,
          responseRate: 1,
          unrespondedCount: 0,
          unrespondedNegativeCount: 0,
          pendingReplies: 0,
          rejectedReplies: 0,
          reviewsLast30Days: 4,
          reviewsWithMedia: 2,
          avgResponseTimeHours: 12,
          endpoints: { list: "ok", get: "ok" },
          recommendations: [],
        },
        notifications: {
          configured: true,
          pubsubTopic: "projects/example/topics/gbp",
          enabledTypes: ["NEW_REVIEW", "GOOGLE_UPDATE"],
          missingRecommendedTypes: [],
          deprecatedTypesEnabled: [],
          coverageScore: 100,
          hasReviewAlerts: true,
          hasGoogleUpdateAlerts: true,
          hasCustomerMediaAlerts: true,
          hasVoiceOfMerchantAlerts: true,
        },
      },
      reviews: {
        ...audit.reviews,
        coverage: {
          apiAvailable: true,
          partialApi: false,
          coverageScore: 95,
          reviewCount: 87,
          averageRating: 4.6,
          responseRate: 1,
          unrespondedCount: 0,
          unrespondedNegativeCount: 0,
          pendingReplies: 0,
          rejectedReplies: 0,
          reviewsLast30Days: 4,
          reviewsWithMedia: 2,
          avgResponseTimeHours: 12,
          endpoints: { list: "ok", get: "ok" },
          recommendations: [],
        },
      },
    });
    assert.ok(improved > base);
  });
});

describe("multi-radius visibility", () => {
  const baseKw: KeywordRankSnapshot = {
    keyword: "plumber near me",
    localPackPosition: 1,
    inLocalPack: true,
    geoRanks: [
      { distanceMiles: 1, rank: 1, inLocalPack: true },
      { distanceMiles: 3, rank: 8, inLocalPack: false },
      { distanceMiles: 5, rank: 12, inLocalPack: false },
      { distanceMiles: 10, rank: 15, inLocalPack: false },
    ],
    packLeaderRating: 4.9,
    packLeaderReviewCount: 200,
    clientRating: 4.6,
    clientReviewCount: 87,
  };

  it("blends wider radii so #1 at 1mi alone does not score 100", () => {
    const metroScore = keywordServiceAreaVisibilityScore(baseKw, RADIUS_PROFILE_WEIGHTS.metro);
    assert.ok(metroScore < 100);
    assert.ok(metroScore > 0);
  });

  it("applies pack fragility penalty when in pack at 1mi but not at 3mi", () => {
    const fragileKw: KeywordRankSnapshot = {
      ...baseKw,
      localPackPosition: 2,
      geoRanks: [
        { distanceMiles: 1, rank: 2, inLocalPack: true },
        { distanceMiles: 3, rank: 6, inLocalPack: false },
        { distanceMiles: 5, rank: 9, inLocalPack: false },
        { distanceMiles: 10, rank: 12, inLocalPack: false },
      ],
    };
    const fragile = detectPackFragility(fragileKw);
    assert.equal(fragile.fragile, true);
    assert.equal(fragile.penalty, -8);
    assert.equal(fragile.weakestRadiusMiles, 3);

    const withoutPenalty = keywordServiceAreaVisibilityScore(
      { ...fragileKw, geoRanks: fragileKw.geoRanks.map((g) => ({ ...g, rank: 2, inLocalPack: true })) },
      RADIUS_PROFILE_WEIGHTS.equal
    );
    const withPenalty = keywordServiceAreaVisibilityScore(fragileKw, RADIUS_PROFILE_WEIGHTS.equal);
    assert.ok(withPenalty < withoutPenalty);
  });

  it("weights audit visibility with metro profile for plumbers", () => {
    const audit = createTestAudit();
    const only1mi = {
      ...audit,
      rankings: {
        ...audit.rankings,
        keywords: audit.rankings.keywords.map((kw) =>
          kw.keyword === "plumber near me"
            ? {
                ...kw,
                geoRanks: [
                  { distanceMiles: 1, rank: 1, inLocalPack: true },
                  { distanceMiles: 3, rank: 1, inLocalPack: true },
                  { distanceMiles: 5, rank: 1, inLocalPack: true },
                  { distanceMiles: 10, rank: 1, inLocalPack: true },
                ],
              }
            : kw
        ),
      },
    };
    const wideDrop = {
      ...audit,
      rankings: {
        ...audit.rankings,
        keywords: audit.rankings.keywords.map((kw) =>
          kw.keyword === "plumber near me"
            ? {
                ...kw,
                geoRanks: [
                  { distanceMiles: 1, rank: 1, inLocalPack: true },
                  { distanceMiles: 3, rank: 10, inLocalPack: false },
                  { distanceMiles: 5, rank: 12, inLocalPack: false },
                  { distanceMiles: 10, rank: 15, inLocalPack: false },
                ],
              }
            : kw
        ),
      },
    };
    assert.ok(computeVisibilityScore(wideDrop) < computeVisibilityScore(only1mi));
  });
});

describe("service area revenue capture", () => {
  it("weights click share across radii for revenue capture", () => {
    const strongNear: KeywordRankSnapshot = {
      keyword: "plumber",
      localPackPosition: 1,
      inLocalPack: true,
      geoRanks: [
        { distanceMiles: 1, rank: 1, inLocalPack: true },
        { distanceMiles: 3, rank: 1, inLocalPack: true },
        { distanceMiles: 5, rank: 1, inLocalPack: true },
        { distanceMiles: 10, rank: 1, inLocalPack: true },
      ],
      packLeaderRating: 4.9,
      packLeaderReviewCount: 200,
      clientRating: 4.6,
      clientReviewCount: 87,
    };
    const weakFar: KeywordRankSnapshot = {
      ...strongNear,
      geoRanks: [
        { distanceMiles: 1, rank: 1, inLocalPack: true },
        { distanceMiles: 3, rank: 8, inLocalPack: false },
        { distanceMiles: 5, rank: 10, inLocalPack: false },
        { distanceMiles: 10, rank: 12, inLocalPack: false },
      ],
    };

    const strongScore = keywordServiceAreaRevenueCaptureScore(
      strongNear,
      RADIUS_PROFILE_WEIGHTS.metro
    );
    const weakScore = keywordServiceAreaRevenueCaptureScore(
      weakFar,
      RADIUS_PROFILE_WEIGHTS.metro
    );
    assert.ok(strongScore > weakScore);

    const audit = createTestAudit();
    const strongAudit = {
      ...audit,
      rankings: {
        ...audit.rankings,
        keywords: audit.rankings.keywords.map((kw) =>
          kw.keyword === "plumber near me" ? strongNear : kw
        ),
      },
    };
    const weakAudit = {
      ...audit,
      rankings: {
        ...audit.rankings,
        keywords: audit.rankings.keywords.map((kw) =>
          kw.keyword === "plumber near me" ? weakFar : kw
        ),
      },
    };
    assert.ok(
      computeRevenueCaptureScore(weakAudit) < computeRevenueCaptureScore(strongAudit)
    );
  });
});

describe("gap score impact", () => {
  it("tags gaps with score component and impact", () => {
    const audit = createTestAudit();
    const gaps = detectGaps(audit);
    assert.ok(gaps.length > 0);
    for (const gap of gaps) {
      assert.ok(gap.scoreComponent);
      assert.ok(gap.scoreImpact != null && gap.scoreImpact > 0);
    }
    const rankGap = gaps.find((g) => g.id.startsWith("rank-outside-pack"));
    assert.ok(rankGap);
    assert.equal(rankGap!.scoreComponent, "visibility");
    assert.ok(gapScoreImpact(rankGap!) >= 8);
    assert.equal(gapDriverScoreImpact(rankGap!), 0);
  });
});
