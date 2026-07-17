import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  identifyDisputeCandidates,
  shouldSuppressDisputeCandidate,
} from "./candidates";
import type { ReviewDisputeRecord } from "./types";

function dispute(
  overrides: Partial<ReviewDisputeRecord> & Pick<ReviewDisputeRecord, "reviewId" | "status">
): ReviewDisputeRecord {
  return {
    id: "dispute-1",
    businessId: "biz-1",
    userId: "user-1",
    policyViolation: "not_helpful",
    evidenceNotes: null,
    reviewerName: "Alex",
    reviewRating: 1,
    reviewText: "Terrible",
    reviewPublishedAt: "2026-01-01T00:00:00.000Z",
    executionTaskId: null,
    projectedScoreGain: 2,
    submittedAt: overrides.status === "submitted" ? "2026-07-01T00:00:00.000Z" : null,
    resolvedAt: null,
    resolutionNotes: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("identifyDisputeCandidates", () => {
  it("suppresses draft/flagged/removed but re-queues submitted reviews for another dispute", () => {
    const audit = createTestAudit();
    audit.reviews.reviews = [
      {
        id: "review-submitted",
        author: "Alex",
        rating: 1,
        text: "Awful service",
        publishedAt: "2026-06-01T00:00:00.000Z",
        responded: false,
        isAnonymous: false,
      },
      {
        id: "review-flagged",
        author: "Blake",
        rating: 1,
        text: "Spam spam spam",
        publishedAt: "2026-06-02T00:00:00.000Z",
        responded: false,
        isAnonymous: false,
      },
      {
        id: "review-removed",
        author: "Casey",
        rating: 1,
        text: "Fake review",
        publishedAt: "2026-06-03T00:00:00.000Z",
        responded: false,
        isAnonymous: false,
      },
      {
        id: "review-fresh",
        author: "Drew",
        rating: 1,
        text: "Never going back",
        publishedAt: "2026-06-04T00:00:00.000Z",
        responded: false,
        isAnonymous: false,
      },
    ];
    audit.reviews.disputeCandidates = audit.reviews.reviews.map((r) => r.id);

    const existing = [
      dispute({ reviewId: "review-submitted", status: "submitted" }),
      dispute({ id: "dispute-2", reviewId: "review-flagged", status: "flagged" }),
      dispute({ id: "dispute-3", reviewId: "review-removed", status: "removed" }),
    ];

    assert.equal(shouldSuppressDisputeCandidate(existing[0]), false);
    assert.equal(shouldSuppressDisputeCandidate(existing[1]), true);
    assert.equal(shouldSuppressDisputeCandidate(existing[2]), true);

    const candidates = identifyDisputeCandidates(audit, existing);
    const ids = candidates.map((c) => c.reviewId);

    assert.ok(ids.includes("review-submitted"));
    assert.ok(ids.includes("review-fresh"));
    assert.equal(ids.includes("review-flagged"), false);
    assert.equal(ids.includes("review-removed"), false);

    const submitted = candidates.find((c) => c.reviewId === "review-submitted");
    assert.ok(submitted?.priorSubmissionAt);
    assert.equal(submitted?.priorDisputeStatus, "submitted");
  });

  it("also re-queues declined disputes for another attempt", () => {
    const audit = createTestAudit();
    audit.reviews.reviews = [
      {
        id: "review-declined",
        author: "Alex",
        rating: 1,
        text: "Bad experience",
        publishedAt: "2026-06-01T00:00:00.000Z",
        responded: false,
        isAnonymous: false,
      },
    ];
    audit.reviews.disputeCandidates = ["review-declined"];

    const candidates = identifyDisputeCandidates(audit, [
      dispute({
        reviewId: "review-declined",
        status: "declined",
        submittedAt: "2026-06-15T00:00:00.000Z",
      }),
    ]);

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].reviewId, "review-declined");
  });
});
