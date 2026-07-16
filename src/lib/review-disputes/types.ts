export const REVIEW_DISPUTE_POLICY_VIOLATIONS = [
  "fake_content",
  "not_a_customer",
  "conflict_of_interest",
  "off_topic",
  "spam",
  "harassment",
  "privacy_violation",
  "other",
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

export const POLICY_VIOLATION_LABELS: Record<ReviewDisputePolicyViolation, string> = {
  fake_content: "Fake or misleading content",
  not_a_customer: "Not a genuine customer",
  conflict_of_interest: "Conflict of interest",
  off_topic: "Off-topic / irrelevant",
  spam: "Spam or promotional",
  harassment: "Harassment or hate speech",
  privacy_violation: "Privacy violation",
  other: "Other policy violation",
};
