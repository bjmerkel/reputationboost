import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  KeywordPortfolioAnalysis,
  KeywordPortfolioStatus,
  Phase1AuditPayload,
  TrackedKeywordPortfolioItem,
} from "../types";
import { createTestAudit } from "../phase3/test-fixtures";
import { planKeywordRankScans } from "./rank-scan-plan";

function tracked(
  keyword: string,
  status: KeywordPortfolioStatus,
  overrides: Partial<TrackedKeywordPortfolioItem> = {}
): TrackedKeywordPortfolioItem {
  return {
    keyword,
    status,
    inLocalPack: true,
    localPackPosition: 2,
    visibilityScore: 85,
    relevanceScore: 70,
    matchedImpressions: null,
    packFragile: false,
    reason: "test",
    ...overrides,
  };
}

function auditWithPortfolio(
  trackedItems: TrackedKeywordPortfolioItem[]
): Phase1AuditPayload {
  const audit = createTestAudit();
  const portfolio: KeywordPortfolioAnalysis = {
    computedAt: "2026-07-14T00:00:00.000Z",
    demandAlignmentScore: 40,
    rankWithoutDemandCount: trackedItems.filter(
      (item) => item.status === "rank_without_demand"
    ).length,
    untrackedDemandCount: 0,
    tracked: trackedItems,
    untrackedCandidates: [],
    recommendedSwaps: [],
    recommendedKeywords: trackedItems.map((item) => item.keyword),
    shouldRotate: false,
    summary: "test",
  };

  return {
    ...audit,
    gbp: {
      ...audit.gbp,
      performance: {
        ...audit.gbp.performance,
        searchKeywords: [
          { keyword: "plumber", impressions: 100, belowThreshold: false },
        ],
      },
    },
    keywordPortfolio: portfolio,
  };
}

describe("planKeywordRankScans", () => {
  const items = [
    tracked("plumber", "proven_demand", { matchedImpressions: 100 }),
    tracked("emergency plumber", "growth_target", { inLocalPack: false }),
    tracked("acme plumbing", "brand_anchor"),
    tracked("plumber north suburb", "rank_without_demand"),
    tracked("plumber south suburb", "low_priority"),
  ];
  const keywords = items.map((item) => item.keyword);

  it("defers only stable in-pack terms without GBP demand", () => {
    const plan = planKeywordRankScans({
      keywords,
      audit: auditWithPortfolio(items),
      targetDate: "2026-07-14",
      context: "daily",
      enabled: true,
      minLiveScans: 3,
    });

    assert.ok(plan.liveScan.includes("plumber"));
    assert.ok(plan.liveScan.includes("emergency plumber"));
    assert.ok(plan.liveScan.includes("acme plumbing"));
    assert.equal(plan.deferred.length, 1);
    assert.equal(plan.forcedRescan.length, 1);
    assert.ok(
      ["plumber north suburb", "plumber south suburb"].includes(
        plan.forcedRescan[0]
      )
    );
  });

  it("scans everything when GBP keyword reporting is unavailable", () => {
    const audit = auditWithPortfolio(items);
    audit.gbp.performance.searchKeywords = [];

    const plan = planKeywordRankScans({
      keywords,
      audit,
      targetDate: "2026-07-14",
      context: "daily",
      enabled: true,
      minLiveScans: 3,
    });

    assert.deepEqual(plan.liveScan, keywords);
    assert.equal(plan.deferred.length, 0);
  });

  it("rotates deferred terms back into daily live scans", () => {
    const audit = auditWithPortfolio(items);
    const first = planKeywordRankScans({
      keywords,
      audit,
      targetDate: "2026-07-14",
      context: "daily",
      enabled: true,
      minLiveScans: 3,
    });
    const next = planKeywordRankScans({
      keywords,
      audit,
      targetDate: "2026-07-15",
      context: "daily",
      enabled: true,
      minLiveScans: 3,
    });

    assert.notDeepEqual(first.forcedRescan, next.forcedRescan);
  });

  it("never defers fragile or impression-backed keywords", () => {
    const protectedItems = [
      tracked("fragile plumber", "low_priority", { packFragile: true }),
      tracked("demand plumber", "low_priority", { matchedImpressions: 12 }),
      tracked("stable plumber", "rank_without_demand"),
      tracked("second stable plumber", "rank_without_demand"),
    ];

    const plan = planKeywordRankScans({
      keywords: protectedItems.map((item) => item.keyword),
      audit: auditWithPortfolio(protectedItems),
      targetDate: "2026-07-14",
      context: "weekly_grid",
      enabled: true,
      minLiveScans: 2,
    });

    assert.ok(plan.liveScan.includes("fragile plumber"));
    assert.ok(plan.liveScan.includes("demand plumber"));
    assert.equal(plan.deferred.length, 1);
  });
});
