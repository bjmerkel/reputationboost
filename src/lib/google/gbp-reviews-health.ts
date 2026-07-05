import type { GbpReviewCoverage } from "@/audit/types";

export interface ReviewsHealthReport {
  overallScore: number;
  apiAvailable: boolean;
  partialApi: boolean;
  reviewCount: number;
  averageRating: number;
  responseRate: number;
  unrespondedNegativeCount: number;
  pendingReplies: number;
  rejectedReplies: number;
  avgResponseTimeHours: number | null;
  recommendations: string[];
}

/** Summarize review health for dashboard display. */
export function buildReviewsHealthReport(coverage: GbpReviewCoverage): ReviewsHealthReport {
  return {
    overallScore: coverage.coverageScore,
    apiAvailable: coverage.apiAvailable,
    partialApi: coverage.partialApi,
    reviewCount: coverage.reviewCount,
    averageRating: coverage.averageRating,
    responseRate: coverage.responseRate,
    unrespondedNegativeCount: coverage.unrespondedNegativeCount,
    pendingReplies: coverage.pendingReplies,
    rejectedReplies: coverage.rejectedReplies,
    avgResponseTimeHours: coverage.avgResponseTimeHours,
    recommendations: coverage.recommendations,
  };
}
