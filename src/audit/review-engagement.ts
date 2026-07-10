import type { Phase1AuditPayload, ReviewRecord } from "./types";

export const REVIEW_RESPONSE_RATE_TARGET = 0.85;

/** True when a review already has a live or in-flight owner reply. */
export function isReviewRecordResponded(review: ReviewRecord): boolean {
  return (
    review.responded ||
    Boolean(review.replyText?.trim()) ||
    review.replyState === "APPROVED" ||
    review.replyState === "PENDING"
  );
}

export function countUnrespondedNegativeReviews(reviews: ReviewRecord[]): number {
  return reviews.filter((review) => review.rating <= 3 && !isReviewRecordResponded(review)).length;
}

/** Fraction of reviews with an owner reply (0–1), or null when there are no reviews. */
export function computeReviewResponseRateFromRecords(reviews: ReviewRecord[]): number | null {
  if (reviews.length === 0) return null;
  const responded = reviews.filter(isReviewRecordResponded).length;
  return responded / reviews.length;
}

function normalizeCoverageResponseRate(rate: number): number {
  return rate > 1 ? rate / 100 : rate;
}

/** Best available review response rate as a 0–1 fraction. */
export function resolveReviewResponseRate(audit: Phase1AuditPayload): number {
  const fromRecords = computeReviewResponseRateFromRecords(audit.reviews.reviews);
  if (fromRecords !== null) return fromRecords;

  const coverage = audit.reviews.coverage ?? audit.gbp.reviewCoverage;
  if (coverage?.apiAvailable && coverage.reviewCount > 0) {
    return normalizeCoverageResponseRate(coverage.responseRate);
  }

  return audit.gbp.engagement.responseRate ?? 0;
}

export function isReviewResponseWorkSatisfied(audit: Phase1AuditPayload): boolean {
  const reviews = audit.reviews.reviews;
  const unrespondedNegative =
    reviews.length > 0
      ? countUnrespondedNegativeReviews(reviews)
      : audit.reviews.unrespondedNegative;

  return (
    unrespondedNegative === 0 &&
    resolveReviewResponseRate(audit) >= REVIEW_RESPONSE_RATE_TARGET
  );
}

/** Align stale audit engagement fields with collected review records. */
export function syncReviewEngagementMetrics(audit: Phase1AuditPayload): void {
  const reviews = audit.reviews.reviews;
  if (reviews.length === 0) return;

  const responseRate = computeReviewResponseRateFromRecords(reviews);
  if (responseRate !== null) {
    audit.gbp.engagement.responseRate = responseRate;
  }

  audit.reviews.unrespondedNegative = countUnrespondedNegativeReviews(reviews);

  const coverage = audit.reviews.coverage ?? audit.gbp.reviewCoverage;
  if (!coverage) return;

  const fraction = responseRate ?? audit.gbp.engagement.responseRate;
  const unresponded = reviews.filter((review) => !isReviewRecordResponded(review)).length;
  const updated = {
    ...coverage,
    responseRate: Math.round(fraction * 1000) / 10,
    unrespondedCount: unresponded,
    unrespondedNegativeCount: audit.reviews.unrespondedNegative,
  };

  audit.reviews.coverage = updated;
  audit.gbp.reviewCoverage = updated;
}
