import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Phase1AuditPayload } from "../types";
import { createTestAudit } from "../phase3/test-fixtures";
import {
  applyKeywordPortfolioToAudit,
  applyTrackedKeywordsToAudit,
  buildOptimizedKeywordList,
  computeKeywordPortfolio,
  findTrackedKeywordForGbpTerm,
  isBrandKeyword,
  isJunkTrackingKeyword,
  portfolioStepIsSatisfied,
  prioritizeKeywordsForGrid,
} from "./keyword-portfolio";
import { simulateGapDriverImpact } from "./counterfactual";
import { gapDriverScoreImpact, gapOutcomeScoreImpact } from "./score-impact";

function wayneStyleAudit(): Phase1AuditPayload {
  const audit = createTestAudit();
  return {
    ...audit,
    clientName: "Wayne Refrigeration",
    gbp: {
      ...audit.gbp,
      identity: {
        ...audit.gbp.identity,
        name: "Wayne Refrigeration",
        address: "123 Main St, Wayne, NJ 07470",
        primaryCategory: "HVAC contractor",
      },
      performance: {
        ...audit.gbp.performance,
        profileViews: 199,
        impressionsMaps: 67,
        impressionsSearch: 132,
        calls: 2,
        websiteClicks: 3,
        searchKeywords: [
          { keyword: "wayne", impressions: 132, belowThreshold: false },
          { keyword: "wayne, nj", impressions: 45, belowThreshold: false },
          { keyword: "hvac contractor", impressions: null, belowThreshold: true },
          { keyword: "hvac company wayne", impressions: null, belowThreshold: true },
          {
            keyword: "495 river street – hvac and roof replacement",
            impressions: null,
            belowThreshold: true,
          },
          { keyword: "cost to replace hvac system nj", impressions: null, belowThreshold: true },
        ],
      },
    },
    rankings: {
      ...audit.rankings,
      keywords: [
        {
          keyword: "hvac installation ridgewood nj",
          localPackPosition: 1,
          inLocalPack: true,
          geoRanks: [
            { distanceMiles: 1, rank: 1, inLocalPack: true },
            { distanceMiles: 3, rank: 1, inLocalPack: true },
            { distanceMiles: 5, rank: 1, inLocalPack: true },
          ],
          packLeaderRating: 4.9,
          packLeaderReviewCount: 180,
          clientRating: 4.7,
          clientReviewCount: 95,
        },
        {
          keyword: "emergency ac repair ridgewood",
          localPackPosition: 1,
          inLocalPack: true,
          geoRanks: [
            { distanceMiles: 1, rank: 1, inLocalPack: true },
            { distanceMiles: 3, rank: 1, inLocalPack: true },
            { distanceMiles: 5, rank: 1, inLocalPack: true },
          ],
          packLeaderRating: 4.9,
          packLeaderReviewCount: 180,
          clientRating: 4.7,
          clientReviewCount: 95,
        },
        {
          keyword: "air conditioning service ridgewood",
          localPackPosition: 1,
          inLocalPack: true,
          geoRanks: [
            { distanceMiles: 1, rank: 1, inLocalPack: true },
            { distanceMiles: 3, rank: 1, inLocalPack: true },
            { distanceMiles: 5, rank: 1, inLocalPack: true },
          ],
          packLeaderRating: 4.9,
          packLeaderReviewCount: 180,
          clientRating: 4.7,
          clientReviewCount: 95,
        },
        {
          keyword: "furnace maintenance near me",
          localPackPosition: 2,
          inLocalPack: true,
          geoRanks: [
            { distanceMiles: 1, rank: 2, inLocalPack: true },
            { distanceMiles: 3, rank: 2, inLocalPack: true },
            { distanceMiles: 5, rank: 3, inLocalPack: true },
          ],
          packLeaderRating: 4.9,
          packLeaderReviewCount: 180,
          clientRating: 4.7,
          clientReviewCount: 95,
        },
      ],
    },
  };
}

describe("keyword-portfolio", () => {
  it("detects brand keywords from business name tokens", () => {
    assert.equal(isBrandKeyword("wayne", "Wayne Refrigeration", "Wayne"), true);
    assert.equal(isBrandKeyword("wayne, nj", "Wayne Refrigeration", "Wayne"), true);
    assert.equal(isBrandKeyword("hvac installation ridgewood nj", "Wayne Refrigeration", "Wayne"), false);
  });

  it("rejects city-only, street-address, and listing junk as trackable keywords", () => {
    assert.equal(isJunkTrackingKeyword("wayne, nj", "Wayne Refrigeration", "wayne"), true);
    assert.equal(
      isJunkTrackingKeyword(
        "495 river street – hvac and roof replacement",
        "Wayne Refrigeration",
        "wayne"
      ),
      true
    );
    assert.equal(isJunkTrackingKeyword("hvac company wayne", "Wayne Refrigeration", "wayne"), false);
    assert.equal(
      isJunkTrackingKeyword("hvac contractor wayne", "Wayne Refrigeration", "wayne"),
      false
    );
  });

  it("reverse-matches GBP terms to tracked keywords", () => {
    const tracked = ["hvac installation ridgewood nj", "emergency ac repair ridgewood"];
    assert.equal(findTrackedKeywordForGbpTerm("ridgewood hvac", tracked), null);
    assert.equal(
      findTrackedKeywordForGbpTerm("emergency ac repair ridgewood", tracked),
      "emergency ac repair ridgewood"
    );
  });

  it("flags rank-without-demand mismatch for Wayne-style HVAC profile", () => {
    const portfolio = computeKeywordPortfolio(wayneStyleAudit());

    assert.ok(portfolio.rankWithoutDemandCount >= 2);
    assert.ok(
      portfolio.untrackedCandidates.some(
        (c) =>
          c.sourceGbpTerm === "wayne" ||
          c.sourceGbpTerm === "wayne, nj" ||
          c.keyword.includes("wayne")
      )
    );
    assert.ok(portfolio.recommendedSwaps.length > 0);
    assert.ok(portfolio.shouldRotate);
    assert.ok(portfolio.demandAlignmentScore < 50);
    assert.match(portfolio.summary, /no impressions/i);
  });

  it("recommends service keywords instead of city-only or address junk", () => {
    const audit = wayneStyleAudit();
    const portfolio = computeKeywordPortfolio(audit);
    const optimized = buildOptimizedKeywordList(
      audit,
      audit.rankings.keywords.map((k) => k.keyword)
    );

    assert.ok(
      portfolio.untrackedCandidates.every(
        (c) => !isJunkTrackingKeyword(c.keyword, "Wayne Refrigeration", "wayne")
      )
    );
    assert.ok(
      !portfolio.recommendedSwaps.some(
        (swap) =>
          swap.swapIn === "wayne, nj" ||
          swap.swapIn.includes("river street") ||
          swap.swapIn === "wayne"
      )
    );
    assert.ok(optimized.some((keyword) => /hvac|contractor|company/.test(keyword)));
    assert.ok(
      portfolio.recommendedSwaps.some(
        (swap) => swap.swapIn.includes("wayne") || swap.swapOut.includes("ridgewood")
      )
    );
  });

  it("does not re-add swapped-out keywords to the optimized portfolio", () => {
    const audit = wayneStyleAudit();
    const portfolio = computeKeywordPortfolio(audit);
    const swappedOut = new Set(
      portfolio.recommendedSwaps.map((swap) => swap.swapOut.toLowerCase())
    );

    assert.ok(swappedOut.size > 0);
    for (const keyword of portfolio.recommendedKeywords) {
      assert.equal(
        swappedOut.has(keyword.toLowerCase()),
        false,
        `optimized list should not keep swapped-out keyword "${keyword}"`
      );
    }
  });

  it("prioritizes growth and demand keywords for weekly grid slots", () => {
    const audit = wayneStyleAudit();
    const portfolio = computeKeywordPortfolio(audit);
    const keywords = portfolio.recommendedKeywords;
    const prioritized = prioritizeKeywordsForGrid(audit, keywords, 3);

    assert.equal(prioritized.length, 3);
    assert.ok(prioritized.some((keyword) => keyword.includes("wayne") || keyword.includes("ridgewood")));
  });

  it("projects score gains when portfolio gaps are closed", () => {
    const audit = wayneStyleAudit();
    const portfolio = computeKeywordPortfolio(audit);
    audit.keywordPortfolio = portfolio;

    const gap = {
      id: "keyword-portfolio-mismatch",
      priority: "P1" as const,
      category: "rankings" as const,
      title: "Tracked keywords don't match search demand",
      description: portfolio.summary,
      impact: 9,
      effort: 2,
      impactScore: 9,
    };

    assert.ok(simulateGapDriverImpact(audit, gap) >= 0);
    assert.ok(gapOutcomeScoreImpact(gap, audit) >= 0);
    assert.ok(gapDriverScoreImpact(gap, audit) > 0);
  });

  it("marks portfolio step satisfied after applying recommendations", () => {
    const audit = wayneStyleAudit();
    audit.keywordPortfolio = computeKeywordPortfolio(audit);
    assert.equal(portfolioStepIsSatisfied(audit), false);

    applyKeywordPortfolioToAudit(audit);
    assert.equal(portfolioStepIsSatisfied(audit), true);
  });

  it("optimistically syncs rankings when tracked keywords are edited", () => {
    const audit = wayneStyleAudit();
    const kept = audit.rankings.keywords[0]!.keyword;
    const next = applyTrackedKeywordsToAudit(audit, [
      kept,
      "hvac repair wayne nj",
      "ac installation wayne",
    ]);

    assert.deepEqual(
      next.rankings.keywords.map((item) => item.keyword),
      [kept, "hvac repair wayne nj", "ac installation wayne"]
    );
    assert.equal(next.rankings.totalKeywords, 3);
    assert.equal(
      next.rankings.keywords.find((item) => item.keyword === kept)?.localPackPosition,
      audit.rankings.keywords[0]!.localPackPosition
    );
    assert.ok(next.keywordPortfolio);
    assert.notEqual(next, audit);
  });
});
