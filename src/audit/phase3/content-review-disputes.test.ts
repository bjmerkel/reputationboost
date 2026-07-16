import assert from "node:assert/strict";
import test from "node:test";
import { buildReviewDisputeTasks } from "@/audit/phase3/gbp-plan-tasks";
import { createTestAudit } from "@/audit/phase3/test-fixtures";

test("buildReviewDisputeTasks creates one task per dispute candidate", () => {
  const audit = createTestAudit();
  audit.reviews.disputeCandidates = ["review-1", "review-2"];
  audit.reviews.reviews = [
    {
      id: "review-1",
      rating: 1,
      text: "Never hired them",
      author: "Alex",
      publishedAt: "2026-01-01T00:00:00.000Z",
      responded: false,
      responseTimeHours: null,
      sentiment: "negative",
    },
    {
      id: "review-2",
      rating: 2,
      text: "Spam link www.example.com",
      author: "Sam",
      publishedAt: "2026-01-02T00:00:00.000Z",
      responded: false,
      responseTimeHours: null,
      sentiment: "negative",
    },
  ];

  const step = {
    stepNumber: 9,
    title: "Dispute Illegitimate Reviews",
    instruction: "Dispute bad reviews",
  } as const;

  const tasks = buildReviewDisputeTasks(audit, step);
  assert.equal(tasks.length, 2);
  assert.ok(tasks.every((t) => t.type === "review_dispute"));
  assert.equal(tasks[0]?.payload.reviewId, "review-1");
});
