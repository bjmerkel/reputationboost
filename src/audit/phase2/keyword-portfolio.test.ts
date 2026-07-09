import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Phase1AuditPayload } from "../types";
import { createTestAudit } from "../phase3/test-fixtures";
import {
  buildOptimizedKeywordList,
  computeKeywordPortfolio,
  findTrackedKeywordForGbpTerm,
  isBrandKeyword,
  prioritizeKeywordsForGrid,
} from "./keyword-portfolio";

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
    assert.ok(portfolio.untrackedCandidates.some((c) => c.sourceGbpTerm === "wayne"));
    assert.ok(portfolio.recommendedSwaps.length > 0);
    assert.ok(portfolio.shouldRotate);
    assert.ok(portfolio.demandAlignmentScore < 50);
    assert.match(portfolio.summary, /no impressions/i);
  });

  it("recommends adding demand-backed terms and swapping rank-only keywords", () => {
    const audit = wayneStyleAudit();
    const portfolio = computeKeywordPortfolio(audit);
    const optimized = buildOptimizedKeywordList(audit, audit.rankings.keywords.map((k) => k.keyword));

    assert.ok(optimized.some((keyword) => keyword.includes("wayne")));
    assert.ok(
      portfolio.recommendedSwaps.some(
        (swap) => swap.swapIn.includes("wayne") || swap.swapOut.includes("ridgewood")
      )
    );
  });

  it("prioritizes growth and demand keywords for weekly grid slots", () => {
    const audit = wayneStyleAudit();
    const portfolio = computeKeywordPortfolio(audit);
    const keywords = portfolio.recommendedKeywords;
    const prioritized = prioritizeKeywordsForGrid(audit, keywords, 3);

    assert.equal(prioritized.length, 3);
    assert.ok(prioritized.some((keyword) => keyword.includes("wayne") || keyword.includes("ridgewood")));
  });
});
