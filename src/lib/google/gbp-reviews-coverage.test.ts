import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeGbpReviewCoverage,
  formatReviewCoverageSummary,
} from "./gbp-reviews-coverage";
import { isReviewResponded, parseGbpReview } from "./gbp-reviews";

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

describe("parseGbpReview", () => {
  it("maps star ratings, replies, and media items", () => {
    const review = parseGbpReview({
      name: "accounts/1/locations/2/reviews/abc",
      reviewId: "abc",
      reviewer: { displayName: "Alex", profilePhotoUrl: "https://example.com/a.jpg" },
      starRating: "FIVE",
      comment: "Great service",
      createTime: daysAgo(2),
      reviewReply: {
        comment: "Thanks Alex!",
        updateTime: daysAgo(1),
        reviewReplyState: "APPROVED",
      },
      reviewMediaItems: [{ thumbnailUrl: "https://example.com/thumb.jpg" }],
    });

    assert.equal(review.rating, 5);
    assert.equal(review.reviewer, "Alex");
    assert.equal(isReviewResponded(review), true);
    assert.equal(review.mediaItems.length, 1);
  });
});

describe("analyzeGbpReviewCoverage", () => {
  it("marks unavailable API with zero coverage", () => {
    const coverage = analyzeGbpReviewCoverage({
      reviews: [],
      probe: { endpoints: { list: "failed" } },
    });

    assert.equal(coverage.apiAvailable, false);
    assert.equal(coverage.coverageScore, 0);
    assert.ok(coverage.recommendations.some((item) => item.includes("Reconnect")));
  });

  it("scores strong review management highly", () => {
    const coverage = analyzeGbpReviewCoverage({
      reviews: [
        {
          name: "accounts/1/locations/2/reviews/1",
          reviewId: "1",
          reviewer: "Sam",
          isAnonymous: false,
          rating: 5,
          comment: "Excellent",
          createTime: daysAgo(3),
          mediaItems: [],
          reviewReply: {
            comment: "Thank you!",
            updateTime: daysAgo(2),
            reviewReplyState: "APPROVED",
          },
        },
        {
          name: "accounts/1/locations/2/reviews/2",
          reviewId: "2",
          reviewer: "Jamie",
          isAnonymous: false,
          rating: 4,
          comment: "Good work",
          createTime: daysAgo(8),
          mediaItems: [{ thumbnailUrl: "https://example.com/t.jpg" }],
          reviewReply: {
            comment: "Appreciate it!",
            updateTime: daysAgo(7),
            reviewReplyState: "APPROVED",
          },
        },
      ],
      probe: { endpoints: { list: "ok", get: "ok" } },
    });

    assert.equal(coverage.apiAvailable, true);
    assert.equal(coverage.responseRate, 100);
    assert.equal(coverage.unrespondedNegativeCount, 0);
    assert.ok(coverage.coverageScore >= 80);
  });

  it("flags rejected replies and slow response times", () => {
    const coverage = analyzeGbpReviewCoverage({
      reviews: [
        {
          name: "accounts/1/locations/2/reviews/3",
          reviewId: "3",
          reviewer: "Pat",
          isAnonymous: false,
          rating: 2,
          comment: "Late arrival",
          createTime: daysAgo(10),
          mediaItems: [],
        },
        {
          name: "accounts/1/locations/2/reviews/4",
          reviewId: "4",
          reviewer: "Lee",
          isAnonymous: false,
          rating: 5,
          comment: "Fast and friendly",
          createTime: daysAgo(20),
          mediaItems: [],
          reviewReply: {
            comment: "Thanks!",
            updateTime: daysAgo(18),
            reviewReplyState: "REJECTED",
            policyViolation: "OFF_TOPIC",
          },
        },
      ],
      probe: { endpoints: { list: "ok", get: "ok" } },
    });

    assert.equal(coverage.unrespondedNegativeCount, 1);
    assert.equal(coverage.rejectedReplies, 1);
    assert.ok(coverage.recommendations.some((item) => item.includes("negative")));
    assert.ok(coverage.recommendations.some((item) => item.includes("rejected")));
  });
});

describe("formatReviewCoverageSummary", () => {
  it("summarizes review corpus health", () => {
    const summary = formatReviewCoverageSummary({
      apiAvailable: true,
      partialApi: false,
      coverageScore: 88,
      reviewCount: 42,
      averageRating: 4.7,
      responseRate: 91.2,
      unrespondedCount: 4,
      unrespondedNegativeCount: 1,
      pendingReplies: 0,
      rejectedReplies: 0,
      reviewsLast30Days: 6,
      reviewsWithMedia: 2,
      avgResponseTimeHours: 6,
      endpoints: { list: "ok", get: "ok" },
      recommendations: [],
    });

    assert.match(summary, /42 reviews/);
    assert.match(summary, /91.2% responded/);
  });
});
