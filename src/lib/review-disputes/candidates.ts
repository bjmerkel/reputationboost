import type { Phase1AuditPayload, ReviewRecord } from "@/audit/types";
import { classifyReviewPolicyViolation } from "./policy-classifier";
import { estimateReviewRemovalScoreGain } from "./score-impact";
import type { DisputeCandidate } from "./types";
import { buildDisputeEvidenceTemplate } from "./evidence-template";
import type { ReviewDisputeRecord } from "./types";
import { OPEN_DISPUTE_STATUSES } from "./types";

const MAX_CANDIDATES = 12;

export function isDisputeableReview(review: ReviewRecord): boolean {
  if (review.rating > 2) return false;
  if (review.policyViolation) return true;
  return true;
}

export function identifyDisputeCandidates(
  audit: Phase1AuditPayload,
  existingDisputes: ReviewDisputeRecord[] = []
): DisputeCandidate[] {
  const activeDisputeReviewIds = new Set(
    existingDisputes
      .filter((d) => OPEN_DISPUTE_STATUSES.includes(d.status) || d.status === "removed")
      .map((d) => d.reviewId)
  );

  return audit.reviews.reviews
    .filter((review) => isDisputeableReview(review))
    .filter((review) => !activeDisputeReviewIds.has(review.id))
    .map((review) => {
      const classification = classifyReviewPolicyViolation(review);
      const projectedScoreGain = estimateReviewRemovalScoreGain(audit, review.id);
      return {
        reviewId: review.id,
        rating: review.rating,
        text: review.text ?? "",
        author: review.author,
        publishedAt: review.publishedAt,
        suggestedViolation: classification.violation,
        violationConfidence: classification.confidence,
        violationReason: classification.reason,
        projectedScoreGain,
        evidenceTemplate: buildDisputeEvidenceTemplate(audit, review, classification),
      };
    })
    .sort((a, b) => b.projectedScoreGain - a.projectedScoreGain || a.rating - b.rating)
    .slice(0, MAX_CANDIDATES);
}

export function resolveDisputeCandidateIds(
  audit: Phase1AuditPayload,
  existingDisputes: ReviewDisputeRecord[] = []
): string[] {
  return identifyDisputeCandidates(audit, existingDisputes).map((c) => c.reviewId);
}
