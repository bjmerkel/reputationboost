import type { Phase1AuditPayload, ReviewRecord } from "@/audit/types";
import { classifyReviewPolicyViolation } from "./policy-classifier";
import { estimateReviewRemovalScoreGain } from "./score-impact";
import type { DisputeCandidate } from "./types";
import { buildDisputeEvidenceTemplate } from "./evidence-template";
import type { ReviewDisputeRecord } from "./types";
import { DISPUTE_CANDIDATE_SUPPRESS_STATUSES } from "./types";

const MAX_CANDIDATES = 12;

export function isDisputeableReview(review: ReviewRecord): boolean {
  if (review.rating > 2) return false;
  if (review.policyViolation) return true;
  return true;
}

/** Whether an existing dispute record should keep this review off the candidate list. */
export function shouldSuppressDisputeCandidate(dispute: ReviewDisputeRecord): boolean {
  return DISPUTE_CANDIDATE_SUPPRESS_STATUSES.includes(dispute.status);
}

export function identifyDisputeCandidates(
  audit: Phase1AuditPayload,
  existingDisputes: ReviewDisputeRecord[] = []
): DisputeCandidate[] {
  const suppressedReviewIds = new Set(
    existingDisputes.filter(shouldSuppressDisputeCandidate).map((d) => d.reviewId)
  );

  return audit.reviews.reviews
    .filter((review) => isDisputeableReview(review))
    .filter((review) => !suppressedReviewIds.has(review.id))
    .map((review) => {
      const classification = classifyReviewPolicyViolation(review);
      const projectedScoreGain = estimateReviewRemovalScoreGain(audit, review.id);
      const prior = existingDisputes.find((d) => d.reviewId === review.id);
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
        priorSubmissionAt: prior?.submittedAt ?? null,
        priorDisputeStatus: prior?.status ?? null,
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
