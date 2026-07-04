import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeGbpPerformanceCoverage,
  formatPerformanceCoverageSummary,
} from "./gbp-performance-coverage";

describe("analyzeGbpPerformanceCoverage", () => {
  it("marks unavailable API with zero coverage", () => {
    const coverage = analyzeGbpPerformanceCoverage({
      source: "unavailable",
      calls: 0,
      directionRequests: 0,
      websiteClicks: 0,
      profileViews: 0,
      impressionsMaps: 0,
      impressionsSearch: 0,
      conversations: 0,
      bookings: 0,
      searchKeywords: [],
    });

    assert.equal(coverage.apiAvailable, false);
    assert.equal(coverage.coverageScore, 0);
    assert.equal(coverage.hasCoreMetrics, false);
    assert.ok(coverage.recommendations.some((item) => item.includes("Reconnect")));
  });

  it("scores full API coverage from probe endpoints", () => {
    const coverage = analyzeGbpPerformanceCoverage(
      {
        source: "api",
        calls: 12,
        directionRequests: 8,
        websiteClicks: 5,
        profileViews: 120,
        impressionsMaps: 40,
        impressionsSearch: 80,
        conversations: 0,
        bookings: 0,
        searchKeywords: [{ keyword: "plumber", impressions: 25, belowThreshold: false }],
      },
      {
        ok: true,
        partial: false,
        endpoints: {
          coreMetrics: "ok",
          impressions: "ok",
          searchKeywords: "ok",
        },
      }
    );

    assert.equal(coverage.coverageScore, 100);
    assert.equal(coverage.hasCoreMetrics, true);
    assert.equal(coverage.hasImpressionMetrics, true);
    assert.equal(coverage.hasSearchKeywords, true);
    assert.equal(coverage.trackedKeywordCount, 1);
    assert.ok(coverage.actionRate > 0);
  });

  it("flags partial API when warnings exist", () => {
    const coverage = analyzeGbpPerformanceCoverage(
      {
        source: "api",
        calls: 4,
        directionRequests: 0,
        websiteClicks: 0,
        profileViews: 60,
        impressionsMaps: 0,
        impressionsSearch: 0,
        conversations: 0,
        bookings: 0,
        searchKeywords: [],
        warnings: ["Search terms people used to find you aren't available for this location."],
      },
      {
        ok: true,
        partial: true,
        endpoints: {
          coreMetrics: "ok",
          impressions: "failed",
          searchKeywords: "denied",
        },
      }
    );

    assert.equal(coverage.partialApi, true);
    assert.equal(coverage.hasImpressionMetrics, false);
    assert.equal(coverage.hasSearchKeywords, false);
    assert.ok(coverage.recommendations.some((item) => item.includes("impression")));
    assert.ok(coverage.recommendations.some((item) => item.includes("keyword")));
  });

  it("recommends CTA improvements when views exist without actions", () => {
    const coverage = analyzeGbpPerformanceCoverage({
      source: "api",
      calls: 0,
      directionRequests: 0,
      websiteClicks: 0,
      profileViews: 200,
      impressionsMaps: 50,
      impressionsSearch: 150,
      conversations: 0,
      bookings: 0,
      searchKeywords: [],
    });

    assert.ok(
      coverage.recommendations.some((item) => item.toLowerCase().includes("cta"))
    );
  });
});

describe("formatPerformanceCoverageSummary", () => {
  it("summarizes available performance dimensions", () => {
    const summary = formatPerformanceCoverageSummary({
      apiAvailable: true,
      partialApi: false,
      coverageScore: 85,
      hasCoreMetrics: true,
      hasImpressionMetrics: true,
      hasSearchKeywords: false,
      hasConversations: false,
      hasBookings: false,
      keywordCount: 0,
      trackedKeywordCount: 0,
      totalActions: 10,
      actionRate: 5,
      endpoints: {
        coreMetrics: "ok",
        impressions: "ok",
        searchKeywords: "skipped",
      },
      recommendations: [],
    });

    assert.equal(summary, "actions · views");
  });
});
