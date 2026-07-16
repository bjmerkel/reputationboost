import type { ReviewRecord } from "@/audit/types";
import type { ReviewDisputePolicyViolation } from "./types";

export interface PolicyClassification {
  violation: ReviewDisputePolicyViolation;
  confidence: "high" | "medium" | "low";
  reason: string;
}

const COMPETITOR_PATTERNS =
  /\b(competitor|rival|fake review|paid review|sabotage|planted|smear campaign)\b/i;
const NOT_CUSTOMER_PATTERNS =
  /\b(never (been|visited|used|hired)|don't know|didn't use|not a customer|wrong business|wrong company|never heard of)\b/i;
const SPAM_PATTERNS = /\b(click here|visit (my|our) website|promo code|discount code|www\.|http)/i;
const HARASSMENT_PATTERNS = /\b(idiot|scam|fraud|thief|criminal|lawsuit|sue you)\b/i;
const OFF_TOPIC_PATTERNS =
  /\b(politics|religion|covid|vaccine|election|president|government)\b/i;

export function classifyReviewPolicyViolation(review: ReviewRecord): PolicyClassification {
  const text = `${review.text ?? ""} ${review.author ?? ""}`.trim();

  if (NOT_CUSTOMER_PATTERNS.test(text)) {
    return {
      violation: "not_a_customer",
      confidence: "high",
      reason: "Review text suggests the reviewer was not a customer.",
    };
  }

  if (COMPETITOR_PATTERNS.test(text)) {
    return {
      violation: "conflict_of_interest",
      confidence: "high",
      reason: "Language suggests a competitor or coordinated attack.",
    };
  }

  if (SPAM_PATTERNS.test(text)) {
    return {
      violation: "spam",
      confidence: "high",
      reason: "Review contains promotional or link-spam patterns.",
    };
  }

  if (HARASSMENT_PATTERNS.test(text)) {
    return {
      violation: "harassment",
      confidence: "medium",
      reason: "Review uses inflammatory or harassing language.",
    };
  }

  if (OFF_TOPIC_PATTERNS.test(text)) {
    return {
      violation: "off_topic",
      confidence: "medium",
      reason: "Review content appears unrelated to your business.",
    };
  }

  if (review.rating <= 1 && (!review.text || review.text.length < 20)) {
    return {
      violation: "fake_content",
      confidence: "medium",
      reason: "One-star review with little or no detail — common spam pattern.",
    };
  }

  if (review.rating <= 2) {
    return {
      violation: "fake_content",
      confidence: "low",
      reason: "Low rating with no owner response — worth reviewing for policy violations.",
    };
  }

  return {
    violation: "other",
    confidence: "low",
    reason: "Flag for manual review against Google content policies.",
  };
}
