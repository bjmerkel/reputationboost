import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "./phase3/test-fixtures";
import {
  computeReviewResponseRateFromRecords,
  isReviewResponseWorkSatisfied,
  resolveReviewResponseRate,
  syncReviewEngagementMetrics,
} from "./review-engagement";

describe("review-engagement", () => {
  it("derives response rate from review records instead of stale engagement", () => {
    const audit = createTestAudit();
    audit.gbp.engagement.responseRate = 0;
    audit.reviews.unrespondedNegative = 2;
    audit.reviews.reviews = [
      {
        id: "reviews/1",
        author: "Pat",
        rating: 5,
        text: "Great service",
        publishedAt: "2026-07-01T00:00:00.000Z",
        responded: true,
        replyText: "Thanks for your feedback!",
        replyState: "APPROVED",
        responseTimeHours: 1,
        sentiment: "positive",
      },
      {
        id: "reviews/2",
        author: "Sam",
        rating: 4,
        text: "On time and professional",
        publishedAt: "2026-07-02T00:00:00.000Z",
        responded: true,
        replyText: "Appreciate you!",
        replyState: "APPROVED",
        responseTimeHours: 2,
        sentiment: "positive",
      },
    ];

    assert.equal(computeReviewResponseRateFromRecords(audit.reviews.reviews), 1);
    assert.equal(resolveReviewResponseRate(audit), 1);
    assert.equal(isReviewResponseWorkSatisfied(audit), true);

    syncReviewEngagementMetrics(audit);
    assert.equal(audit.gbp.engagement.responseRate, 1);
    assert.equal(audit.reviews.unrespondedNegative, 0);
  });

  it("treats pending replies as responded for plan satisfaction", () => {
    const audit = createTestAudit();
    audit.gbp.engagement.responseRate = 0;
    audit.reviews.unrespondedNegative = 2;
    audit.reviews.reviews = [
      {
        id: "reviews/1",
        author: "Pat",
        rating: 5,
        text: "Great service",
        publishedAt: "2026-07-01T00:00:00.000Z",
        responded: false,
        replyText: "Thanks!",
        replyState: "PENDING",
        responseTimeHours: 1,
        sentiment: "positive",
      },
      {
        id: "reviews/2",
        author: "Sam",
        rating: 2,
        text: "Late arrival",
        publishedAt: "2026-07-02T00:00:00.000Z",
        responded: true,
        replyText: "Sorry about that.",
        replyState: "APPROVED",
        responseTimeHours: 2,
        sentiment: "negative",
      },
    ];

    assert.equal(isReviewResponseWorkSatisfied(audit), true);
  });
});
