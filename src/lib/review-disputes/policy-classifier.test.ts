import assert from "node:assert/strict";
import test from "node:test";
import { classifyReviewPolicyViolation } from "./policy-classifier";
import { normalizePolicyViolation } from "./types";
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

test("classifyReviewPolicyViolation maps non-customer language to off_topic", () => {
  const result = classifyReviewPolicyViolation(review());
  assert.equal(result.violation, "off_topic");
  assert.equal(result.confidence, "high");
});

test("classifyReviewPolicyViolation flags sparse one-star reviews as spam", () => {
  const result = classifyReviewPolicyViolation(review({ text: "Bad" }));
  assert.equal(result.violation, "spam");
});

test("classifyReviewPolicyViolation detects personal information", () => {
  const result = classifyReviewPolicyViolation(
    review({ text: "Call me at 214-555-0199 about this scam" })
  );
  assert.equal(result.violation, "personal_information");
});

test("normalizePolicyViolation maps legacy stored values", () => {
  assert.equal(normalizePolicyViolation("fake_content"), "spam");
  assert.equal(normalizePolicyViolation("harassment"), "bullying_or_harassment");
  assert.equal(normalizePolicyViolation("off_topic"), "off_topic");
});
