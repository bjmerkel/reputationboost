import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeGbpLocalPostCoverage,
  formatLocalPostCoverageSummary,
  formatLocalPostPreview,
} from "./gbp-local-posts-coverage";

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

describe("analyzeGbpLocalPostCoverage", () => {
  it("marks unavailable API with zero coverage", () => {
    const coverage = analyzeGbpLocalPostCoverage({
      posts: [],
      probe: { endpoints: { list: "failed" } },
    });

    assert.equal(coverage.apiAvailable, false);
    assert.equal(coverage.coverageScore, 0);
    assert.ok(coverage.recommendations.some((item) => item.includes("Reconnect")));
  });

  it("scores fresh live posts highly", () => {
    const coverage = analyzeGbpLocalPostCoverage({
      posts: [
        {
          name: "accounts/1/locations/2/localPosts/3",
          summary: "Spring tune-up special",
          topicType: "STANDARD",
          state: "LIVE",
          createTime: daysAgo(3),
          callToAction: { actionType: "CALL" },
        },
        {
          name: "accounts/1/locations/2/localPosts/4",
          summary: "Free estimate week",
          topicType: "OFFER",
          state: "LIVE",
          createTime: daysAgo(10),
          offer: { couponCode: "SPRING" },
        },
      ],
      probe: { endpoints: { list: "ok", insights: "ok" } },
    });

    assert.equal(coverage.apiAvailable, true);
    assert.equal(coverage.livePostCount, 2);
    assert.equal(coverage.postsLast30Days, 2);
    assert.equal(coverage.hasOfferPost, true);
    assert.ok(coverage.coverageScore >= 70);
  });

  it("flags rejected posts and stale posting cadence", () => {
    const coverage = analyzeGbpLocalPostCoverage({
      posts: [
        {
          name: "accounts/1/locations/2/localPosts/5",
          summary: "Rejected promo",
          topicType: "STANDARD",
          state: "REJECTED",
          createTime: daysAgo(40),
        },
        {
          name: "accounts/1/locations/2/localPosts/6",
          summary: "Old update",
          topicType: "STANDARD",
          state: "LIVE",
          createTime: daysAgo(30),
        },
      ],
      probe: { endpoints: { list: "ok", insights: "skipped" } },
    });

    assert.equal(coverage.rejectedPostCount, 1);
    assert.ok(coverage.daysSinceLastPost !== null && coverage.daysSinceLastPost > 14);
    assert.ok(coverage.recommendations.some((item) => item.includes("rejected")));
    assert.ok(coverage.recommendations.some((item) => item.includes("days ago")));
  });

  it("recommends CTAs when live posts lack buttons", () => {
    const coverage = analyzeGbpLocalPostCoverage({
      posts: [
        {
          name: "accounts/1/locations/2/localPosts/7",
          summary: "We are open Saturdays",
          topicType: "STANDARD",
          state: "LIVE",
          createTime: daysAgo(2),
        },
      ],
      probe: { endpoints: { list: "ok" } },
    });

    assert.equal(coverage.hasCallToActionPosts, false);
    assert.ok(coverage.recommendations.some((item) => item.toLowerCase().includes("call-to-action")));
  });
});

describe("formatLocalPostCoverageSummary", () => {
  it("summarizes live post counts", () => {
    const summary = formatLocalPostCoverageSummary({
      apiAvailable: true,
      partialApi: false,
      coverageScore: 80,
      postCount: 2,
      livePostCount: 2,
      rejectedPostCount: 0,
      processingPostCount: 0,
      postsLast30Days: 2,
      daysSinceLastPost: 5,
      topicTypesUsed: ["STANDARD"],
      hasOfferPost: false,
      hasEventPost: false,
      hasCallToActionPosts: true,
      hasMediaPosts: false,
      totalViews: null,
      endpoints: { list: "ok", insights: "ok" },
      recommendations: [],
    });

    assert.match(summary, /2 live/);
    assert.match(summary, /last 5d ago/);
  });
});

describe("formatLocalPostPreview", () => {
  it("includes topic and action labels", () => {
    const preview = formatLocalPostPreview({
      name: "accounts/1/locations/2/localPosts/1",
      summary: "Book now",
      topicType: "STANDARD",
      callToAction: { actionType: "BOOK", url: "https://example.com" },
    });

    assert.match(preview, /Update/);
    assert.match(preview, /Book/);
  });
});
