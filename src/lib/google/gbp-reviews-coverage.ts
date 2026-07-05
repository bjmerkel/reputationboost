import type { GbpReview } from "./gbp-reviews";
import { computeResponseTimeHours, isReviewResponded } from "./gbp-reviews";

export interface GbpReviewCoverage {
  apiAvailable: boolean;
  partialApi: boolean;
  coverageScore: number;
  reviewCount: number;
  averageRating: number;
  responseRate: number;
  unrespondedCount: number;
  unrespondedNegativeCount: number;
  pendingReplies: number;
  rejectedReplies: number;
  reviewsLast30Days: number;
  reviewsWithMedia: number;
  avgResponseTimeHours: number | null;
  endpoints: {
    list: string;
    get: string;
  };
  recommendations: string[];
}

const RESPONSE_RATE_TARGET = 0.85;
const FAST_RESPONSE_HOURS = 24;

function endpointLabel(status?: string): string {
  return status ?? "skipped";
}

function reviewsInLastDays(reviews: GbpReview[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return reviews.filter((review) => new Date(review.createTime).getTime() >= cutoff).length;
}

function averageRating(reviews: GbpReview[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

function averageResponseTimeHours(reviews: GbpReview[]): number | null {
  const times = reviews
    .map((review) => computeResponseTimeHours(review.createTime, review.reviewReply?.updateTime))
    .filter((value): value is number => value !== null);
  if (times.length === 0) return null;
  return Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
}

/** Score how fully review management is working for a location. */
export function analyzeGbpReviewCoverage(input: {
  reviews: GbpReview[];
  probe?: {
    endpoints?: { list?: string; get?: string };
    partial?: boolean;
  };
}): GbpReviewCoverage {
  const reviews = input.reviews;
  const responded = reviews.filter((review) => isReviewResponded(review));
  const unresponded = reviews.filter((review) => !isReviewResponded(review));
  const unrespondedNegative = unresponded.filter((review) => review.rating <= 3);
  const pendingReplies = reviews.filter((review) => review.reviewReply?.reviewReplyState === "PENDING")
    .length;
  const rejectedReplies = reviews.filter(
    (review) => review.reviewReply?.reviewReplyState === "REJECTED"
  ).length;
  const responseRate = reviews.length > 0 ? responded.length / reviews.length : 0;
  const avgResponseTimeHours = averageResponseTimeHours(reviews);
  const reviewsLast30Days = reviewsInLastDays(reviews, 30);
  const reviewsWithMedia = reviews.filter((review) => review.mediaItems.length > 0).length;

  const apiAvailable =
    input.probe?.endpoints?.list === "ok" || reviews.length > 0 || input.probe === undefined;

  let coverageScore = 0;
  if (!apiAvailable) {
    const recommendations: string[] = [
      "Reconnect GBP with a manager account that has Reviews API access.",
    ];
    return {
      apiAvailable,
      partialApi:
        input.probe?.partial ??
        Boolean(
          input.probe?.endpoints &&
            input.probe.endpoints.list === "ok" &&
            input.probe.endpoints.get &&
            input.probe.endpoints.get !== "ok"
        ),
      coverageScore: 0,
      reviewCount: reviews.length,
      averageRating: averageRating(reviews),
      responseRate: 0,
      unrespondedCount: unresponded.length,
      unrespondedNegativeCount: unrespondedNegative.length,
      pendingReplies,
      rejectedReplies,
      reviewsLast30Days,
      reviewsWithMedia,
      avgResponseTimeHours,
      endpoints: {
        list: endpointLabel(input.probe?.endpoints?.list),
        get: endpointLabel(input.probe?.endpoints?.get),
      },
      recommendations,
    };
  }

  if (apiAvailable) coverageScore += 25;
  if (responseRate >= RESPONSE_RATE_TARGET) coverageScore += 30;
  else coverageScore += Math.round(responseRate * 30);
  if (unrespondedNegative.length === 0) coverageScore += 20;
  if (rejectedReplies === 0) coverageScore += 10;
  if (pendingReplies === 0) coverageScore += 5;
  if (avgResponseTimeHours !== null && avgResponseTimeHours <= FAST_RESPONSE_HOURS) coverageScore += 10;

  const recommendations: string[] = [];
  if (unrespondedNegative.length > 0) {
    recommendations.push(
      `Respond to ${unrespondedNegative.length} negative review${unrespondedNegative.length === 1 ? "" : "s"} within 24 hours.`
    );
  }
  if (responseRate < RESPONSE_RATE_TARGET) {
    recommendations.push(
      `Response rate is ${Math.round(responseRate * 100)}% — aim for at least 85% to signal engagement.`
    );
  }
  if (rejectedReplies > 0) {
    recommendations.push(
      `${rejectedReplies} review repl${rejectedReplies === 1 ? "y was" : "ies were"} rejected — revise and repost without policy violations.`
    );
  }
  if (pendingReplies > 0) {
    recommendations.push(`${pendingReplies} repl${pendingReplies === 1 ? "y is" : "ies are"} pending Google moderation.`);
  }
  if (avgResponseTimeHours !== null && avgResponseTimeHours > FAST_RESPONSE_HOURS) {
    recommendations.push(
      `Average reply time is ${avgResponseTimeHours}h — respond within ${FAST_RESPONSE_HOURS}h when possible.`
    );
  }
  if (reviews.length > 0 && reviewsLast30Days === 0) {
    recommendations.push("No new reviews in 30 days — request fresh reviews from recent customers.");
  }

  return {
    apiAvailable,
    partialApi:
      input.probe?.partial ??
      Boolean(
        input.probe?.endpoints &&
          input.probe.endpoints.list === "ok" &&
          input.probe.endpoints.get &&
          input.probe.endpoints.get !== "ok"
      ),
    coverageScore: Math.min(100, coverageScore),
    reviewCount: reviews.length,
    averageRating: averageRating(reviews),
    responseRate: Math.round(responseRate * 1000) / 10,
    unrespondedCount: unresponded.length,
    unrespondedNegativeCount: unrespondedNegative.length,
    pendingReplies,
    rejectedReplies,
    reviewsLast30Days,
    reviewsWithMedia,
    avgResponseTimeHours,
    endpoints: {
      list: endpointLabel(input.probe?.endpoints?.list),
      get: endpointLabel(input.probe?.endpoints?.get),
    },
    recommendations: recommendations.slice(0, 5),
  };
}

export function formatReviewCoverageSummary(coverage: GbpReviewCoverage): string {
  if (!coverage.apiAvailable) return "unavailable";
  if (coverage.reviewCount === 0) return "no reviews";
  return `${coverage.reviewCount} reviews · ${coverage.responseRate}% responded`;
}
