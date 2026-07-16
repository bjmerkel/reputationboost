import type { ReviewRecord } from "@/audit/types";
import type { ReviewDisputePolicyViolation } from "./types";
import { POLICY_VIOLATION_DESCRIPTIONS } from "./types";

export interface PolicyClassification {
  violation: ReviewDisputePolicyViolation;
  confidence: "high" | "medium" | "low";
  reason: string;
}

const COMPETITOR_PATTERNS =
  /\b(competitor|rival|fake review|paid review|sabotage|planted|smear campaign)\b/i;
const NOT_CUSTOMER_PATTERNS =
  /\b(never (been|visited|used|hired)|don't know|didn't use|not a customer|wrong business|wrong company|never heard of)\b/i;
const SPAM_PATTERNS =
  /\b(click here|visit (my|our) website|promo code|discount code|www\.|https?:\/\/|buy now|call now)\b/i;
const PROFANITY_PATTERNS =
  /\b(fuck|shit|damn|asshole|bitch|bastard|crap|piss|dick|cock|pussy)\b/i;
const BULLYING_PATTERNS =
  /\b(idiot|moron|stupid (owner|manager|employee)|you people|loser|pathetic|worthless)\b/i;
const HARASSMENT_PATTERNS =
  /\b(threaten|kill you|hurt you|sue you|lawsuit|go after you|watch your back)\b/i;
const DISCRIMINATION_PATTERNS =
  /\b(racist|sexist|homophobic|transphobic|bigot|hate (you|them|this group))\b/i;
const PII_PATTERNS =
  /\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{5}(-\d{4})?|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i;
const OFF_TOPIC_PATTERNS =
  /\b(politics|religion|covid|vaccine|election|president|government)\b/i;

function classify(text: string, violation: ReviewDisputePolicyViolation, confidence: PolicyClassification["confidence"], detail?: string): PolicyClassification {
  return {
    violation,
    confidence,
    reason: detail ?? POLICY_VIOLATION_DESCRIPTIONS[violation],
  };
}

export function classifyReviewPolicyViolation(review: ReviewRecord): PolicyClassification {
  const text = `${review.text ?? ""} ${review.author ?? ""}`.trim();

  if (NOT_CUSTOMER_PATTERNS.test(text)) {
    return classify(text, "off_topic", "high", "Review text suggests no real experience with your business.");
  }

  if (COMPETITOR_PATTERNS.test(text)) {
    return classify(text, "conflict_of_interest", "high", "Language suggests a competitor or coordinated attack.");
  }

  if (SPAM_PATTERNS.test(text)) {
    return classify(text, "spam", "high", "Review contains promotional links or spam patterns.");
  }

  if (PII_PATTERNS.test(text)) {
    return classify(text, "personal_information", "high", "Review appears to include a phone number, email, or address.");
  }

  if (PROFANITY_PATTERNS.test(text)) {
    return classify(text, "profanity", "high", "Review contains profane or explicit language.");
  }

  if (DISCRIMINATION_PATTERNS.test(text)) {
    return classify(text, "discrimination_or_hate_speech", "high", "Review may include discriminatory or hateful language.");
  }

  if (BULLYING_PATTERNS.test(text) || HARASSMENT_PATTERNS.test(text)) {
    return classify(text, "bullying_or_harassment", "medium", "Review personally attacks or harasses an individual.");
  }

  if (OFF_TOPIC_PATTERNS.test(text)) {
    return classify(text, "off_topic", "medium", "Review content appears unrelated to your business.");
  }

  if (review.rating <= 1 && (!review.text || review.text.length < 20)) {
    return classify(text, "spam", "medium", "One-star review with little or no detail — common bot or fake-account pattern.");
  }

  if (review.rating <= 2) {
    return classify(
      text,
      "off_topic",
      "low",
      "Low rating worth reviewing — confirm whether it describes a real customer experience."
    );
  }

  return classify(text, "off_topic", "low");
}
