import assert from "node:assert/strict";
import test from "node:test";
import { classifyReviewPolicyViolation } from "./policy-classifier";
import type { ReviewRecord } from "@/audit/types";

function review(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "r1",
    rating: 1,
    text: "Never used this company",
    author: "Jane Doe",
    publishedAt: "2026-01-01T00:00:00.000Z",
    responded: false,
    responseTimeHours: null,
    sentiment: "negative",
    ...overrides,
  };
}

test("classifyReviewPolicyViolation detects not-a-customer language", () => {
  const result = classifyReviewPolicyViolation(review());
  assert.equal(result.violation, "not_a_customer");
  assert.equal(result.confidence, "high");
});

test("classifyReviewPolicyViolation flags sparse one-star reviews as fake_content", () => {
  const result = classifyReviewPolicyViolation(review({ text: "Bad" }));
  assert.equal(result.violation, "fake_content");
});
