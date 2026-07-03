import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KeywordRankSnapshot } from "../types";
import {
  computeHealthScores,
  computeVisibilityScore,
  impressionWeightFloor,
  keywordGeoGridVisibilityScore,
  keywordImpressionWeight,
  matchSearchKeywordImpressions,
  positionVisibilityScore,
} from "./scoring";
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
