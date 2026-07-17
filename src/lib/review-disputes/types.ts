export const REVIEW_DISPUTE_POLICY_VIOLATIONS = [
  "low_quality_information",
  "profanity",
  "harmful",
  "bullying_or_harassment",
  "discrimination_or_hate_speech",
  "personal_information",
  "not_helpful",
] as const;

export type ReviewDisputePolicyViolation = (typeof REVIEW_DISPUTE_POLICY_VIOLATIONS)[number];

export const REVIEW_DISPUTE_STATUSES = [
  "draft",
  "flagged",
  "submitted",
  "under_review",
  "removed",
  "declined",
  "withdrawn",
] as const;

export type ReviewDisputeStatus = (typeof REVIEW_DISPUTE_STATUSES)[number];

export const OPEN_DISPUTE_STATUSES: ReviewDisputeStatus[] = [
  "draft",
  "flagged",
  "submitted",
  "under_review",
];

export const RESOLVED_DISPUTE_STATUSES: ReviewDisputeStatus[] = [
  "removed",
  "declined",
  "withdrawn",
];

/**
 * Statuses that hide a review from the dispute candidate list / plan.
 * `submitted` and `under_review` intentionally do NOT suppress — Google often
 * requires multiple dispute attempts, so Mark Submitted should return the
 * review to the plan for another round.
 */
export const DISPUTE_CANDIDATE_SUPPRESS_STATUSES: ReviewDisputeStatus[] = [
  "draft",
  "flagged",
  "removed",
];

export interface ReviewDisputeRecord {
  id: string;
  businessId: string;
  userId: string;
  reviewId: string;
  status: ReviewDisputeStatus;
  policyViolation: ReviewDisputePolicyViolation;
  evidenceNotes: string | null;
  reviewerName: string | null;
  reviewRating: number | null;
  reviewText: string | null;
  reviewPublishedAt: string | null;
  executionTaskId: string | null;
  projectedScoreGain: number | null;
  submittedAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeCandidate {
  reviewId: string;
  rating: number;
  text: string;
  author: string;
  publishedAt: string;
  suggestedViolation: ReviewDisputePolicyViolation;
  violationConfidence: "high" | "medium" | "low";
  violationReason: string;
  projectedScoreGain: number;
  evidenceTemplate: string;
  /** When set, this review was already filed with Google and is back for another attempt. */
  priorSubmissionAt?: string | null;
  priorDisputeStatus?: ReviewDisputeStatus | null;
}

/** Google Maps report-review categories (display titles). */
export const POLICY_VIOLATION_LABELS: Record<ReviewDisputePolicyViolation, string> = {
  low_quality_information: "Low quality information",
  profanity: "Profanity",
  harmful: "Harmful",
  bullying_or_harassment: "Bullying or harassment",
  discrimination_or_hate_speech: "Discrimination or hate speech",
  personal_information: "Personal information",
  not_helpful: "Not helpful",
};

/** Google's descriptions for each report-review category. */
export const POLICY_VIOLATION_DESCRIPTIONS: Record<ReviewDisputePolicyViolation, string> = {
  low_quality_information:
    "Review is off-topic, contains ads, or is gibberish or repetitive",
  profanity:
    "Review contains swear words, or has pornographic or sexually explicit language",
  harmful:
    "Review contains content that encourages, promotes or provides instructions for self-harm, misuse of dangerous items or substances, or details or encourages graphic violence to people or animals",
  bullying_or_harassment: "Review personally attacks a specific individual",
  discrimination_or_hate_speech:
    "Review has harmful language about an individual or group based on identity",
  personal_information:
    "Review contains personal information, such as an address or phone number",
  not_helpful: "Review doesn't help people decide whether to go to this place",
};

const LEGACY_POLICY_VIOLATION_ALIASES: Record<string, ReviewDisputePolicyViolation> = {
  off_topic: "low_quality_information",
  spam: "low_quality_information",
  conflict_of_interest: "low_quality_information",
  fake_content: "low_quality_information",
  not_a_customer: "low_quality_information",
  harassment: "bullying_or_harassment",
  privacy_violation: "personal_information",
  other: "not_helpful",
};

/** Normalize stored values from older dispute records. */
export function normalizePolicyViolation(
  value: string | null | undefined
): ReviewDisputePolicyViolation {
  if (!value) return "low_quality_information";
  if ((REVIEW_DISPUTE_POLICY_VIOLATIONS as readonly string[]).includes(value)) {
    return value as ReviewDisputePolicyViolation;
  }
  return LEGACY_POLICY_VIOLATION_ALIASES[value] ?? "low_quality_information";
}
