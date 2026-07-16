import type { Phase1AuditPayload, ReviewRecord } from "@/audit/types";
import { computeHealthScores } from "@/audit/phase2/scoring";
import { cloneAudit } from "@/audit/phase2/counterfactual";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Estimated driver-score gain if this review were removed from the profile. */
export function estimateReviewRemovalScoreGain(
  audit: Phase1AuditPayload,
  reviewId: string
): number {
  const review = audit.reviews.reviews.find((r) => r.id === reviewId);
  if (!review) return 0;

  const before = computeHealthScores(audit).driverScore;
  const mutated = cloneAudit(audit);
  removeReview(mutated, review);
  const after = computeHealthScores(mutated).driverScore;
  return Math.max(0, after - before);
}

/** Total projected driver gain if all dispute candidates were removed. */
export function estimateDisputeStepScoreGain(audit: Phase1AuditPayload): number {
  const candidates = audit.reviews.disputeCandidates;
  if (candidates.length === 0) return 0;

  const before = computeHealthScores(audit).driverScore;
  const mutated = cloneAudit(audit);
  for (const id of candidates) {
    const review = mutated.reviews.reviews.find((r) => r.id === id);
    if (review) removeReview(mutated, review);
  }
  const after = computeHealthScores(mutated).driverScore;
  return Math.max(0, after - before);
}

/** Projected overall Reputation Boost Score gain from removing dispute candidates. */
export function estimateDisputeOverallScoreGain(audit: Phase1AuditPayload): number {
  const before = computeHealthScores(audit).overall;
  const mutated = cloneAudit(audit);
  for (const id of audit.reviews.disputeCandidates) {
    const review = mutated.reviews.reviews.find((r) => r.id === id);
    if (review) removeReview(mutated, review);
  }
  const after = computeHealthScores(mutated).overall;
  return Math.max(0, after - before);
}

function removeReview(audit: Phase1AuditPayload, review: ReviewRecord): void {
  audit.reviews.reviews = audit.reviews.reviews.filter((r) => r.id !== review.id);
  audit.reviews.disputeCandidates = audit.reviews.disputeCandidates.filter(
    (id) => id !== review.id
  );

  const remaining = audit.reviews.reviews;
  const count = remaining.length;
  if (count === 0) {
    audit.gbp.engagement.reviewCount = 0;
    audit.gbp.engagement.averageRating = 0;
    audit.reviews.unrespondedNegative = 0;
    return;
  }

  const totalRating = remaining.reduce((sum, r) => sum + r.rating, 0);
  audit.gbp.engagement.reviewCount = count;
  audit.gbp.engagement.averageRating = clamp((totalRating / count) * 10) / 10;
  audit.reviews.unrespondedNegative = remaining.filter(
    (r) => r.rating <= 3 && !r.responded
  ).length;
}
