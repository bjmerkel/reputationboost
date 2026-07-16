export const REVIEW_DISPUTE_POLICY_VIOLATIONS = [
  "off_topic",
  "spam",
  "conflict_of_interest",
  "profanity",
  "bullying_or_harassment",
  "discrimination_or_hate_speech",
  "personal_information",
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
}

/** Google Business Profile dispute categories (display titles). */
export const POLICY_VIOLATION_LABELS: Record<ReviewDisputePolicyViolation, string> = {
  off_topic: "Off topic",
  spam: "Spam",
  conflict_of_interest: "Conflict of interest",
  profanity: "Profanity",
  bullying_or_harassment: "Bullying or harassment",
  discrimination_or_hate_speech: "Discrimination or hate speech",
  personal_information: "Personal information",
};

/** Google's descriptions for each dispute category. */
export const POLICY_VIOLATION_DESCRIPTIONS: Record<ReviewDisputePolicyViolation, string> = {
  off_topic: "Review doesn't pertain to an experience at or with this business",
  spam: "Review is from a bot, a fake account, or contains ads and promotions",
  conflict_of_interest:
    "Review is from someone affiliated with the business or a competitor's business",
  profanity:
    "Review contains swear words, has sexually explicit language, or details graphic violence or other illegal activity",
  bullying_or_harassment: "Review personally attacks a specific individual",
  discrimination_or_hate_speech:
    "Review has harmful language about an individual or group based on identity",
  personal_information: "Contains personal information such as address or phone number",
};

const LEGACY_POLICY_VIOLATION_ALIASES: Record<string, ReviewDisputePolicyViolation> = {
  fake_content: "spam",
  not_a_customer: "off_topic",
  harassment: "bullying_or_harassment",
  privacy_violation: "personal_information",
  other: "off_topic",
};

/** Normalize stored values from older dispute records. */
export function normalizePolicyViolation(
  value: string | null | undefined
): ReviewDisputePolicyViolation {
  if (!value) return "off_topic";
  if ((REVIEW_DISPUTE_POLICY_VIOLATIONS as readonly string[]).includes(value)) {
    return value as ReviewDisputePolicyViolation;
  }
  return LEGACY_POLICY_VIOLATION_ALIASES[value] ?? "off_topic";
}
