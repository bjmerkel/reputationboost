import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";
import {
  analyzeGbpReviewCoverage,
  type GbpReviewCoverage,
} from "./gbp-reviews-coverage";

const GBP_V4 = "https://mybusiness.googleapis.com/v4";

export type ReviewReplyState =
  | "REVIEW_REPLY_STATE_UNSPECIFIED"
  | "PENDING"
  | "REJECTED"
  | "APPROVED";

export type GbpStarRating =
  | "STAR_RATING_UNSPECIFIED"
  | "ONE"
  | "TWO"
  | "THREE"
  | "FOUR"
  | "FIVE";

export type ReviewEndpointStatus = "ok" | "failed" | "denied" | "skipped";

export interface ReviewsApiProbe {
  ok: boolean;
  error?: string;
  permissionDenied: boolean;
  partial?: boolean;
  reviewCount?: number;
  averageRating?: number;
  endpoints?: {
    list: ReviewEndpointStatus;
    get: ReviewEndpointStatus;
  };
  coverage?: GbpReviewCoverage;
}

export interface GbpReviewMediaItem {
  thumbnailUrl: string;
  thumbnailLabel?: string;
  videoUrl?: string;
}

export interface GbpReviewReply {
  comment: string;
  updateTime?: string;
  reviewReplyState?: ReviewReplyState;
  policyViolation?: string;
}

export interface GbpReview {
  name: string;
  reviewId: string;
  reviewer: string;
  reviewerPhotoUrl?: string;
  isAnonymous: boolean;
  rating: number;
  comment: string;
  createTime: string;
  updateTime?: string;
  reviewReply?: GbpReviewReply;
  mediaItems: GbpReviewMediaItem[];
}

interface ReviewApi {
  name?: string;
  reviewId?: string;
  reviewer?: {
    displayName?: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: {
    comment?: string;
    updateTime?: string;
    reviewReplyState?: string;
    policyViolation?: string;
  };
  reviewMediaItems?: Array<{
    thumbnailUrl?: string;
    thumbnailLabel?: string;
    videoUrl?: string;
  }>;
}

function normalizeAccountId(accountId: string): string {
  return accountId.replace(/^accounts\//, "");
}

function normalizeLocationId(locationId: string): string {
  return locationId.replace(/^locations\//, "");
}

function reviewsBase(connection: GbpConnection): string {
  return `${GBP_V4}/accounts/${normalizeAccountId(connection.accountId)}/locations/${normalizeLocationId(connection.locationId)}/reviews`;
}

async function throwApiError(res: Response, data: unknown, fallback: string): Promise<never> {
  const message =
    (data as { error?: { message?: string } })?.error?.message ?? `${fallback} (${res.status})`;
  const err = new Error(message) as Error & { httpStatus?: number };
  err.httpStatus = res.status;
  throw err;
}

function endpointStatusFromError(error: unknown): ReviewEndpointStatus {
  const httpStatus = (error as Error & { httpStatus?: number }).httpStatus;
  if (httpStatus === 403 || httpStatus === 401) return "denied";
  return "failed";
}

function starRatingToNumber(starRating: string | undefined): number {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return starRating ? (map[starRating] ?? 0) : 0;
}

function parseReviewReplyState(value?: string): ReviewReplyState | undefined {
  if (
    value === "PENDING" ||
    value === "REJECTED" ||
    value === "APPROVED" ||
    value === "REVIEW_REPLY_STATE_UNSPECIFIED"
  ) {
    return value;
  }
  return undefined;
}

export function parseGbpReview(raw: ReviewApi, index = 0): GbpReview {
  const isAnonymous = raw.reviewer?.isAnonymous ?? !raw.reviewer?.displayName;
  return {
    name: raw.name ?? "",
    reviewId: raw.reviewId ?? `review-${index}`,
    reviewer: raw.reviewer?.displayName ?? "Anonymous",
    reviewerPhotoUrl: raw.reviewer?.profilePhotoUrl,
    isAnonymous,
    rating: starRatingToNumber(raw.starRating),
    comment: raw.comment ?? "",
    createTime: raw.createTime ?? new Date().toISOString(),
    updateTime: raw.updateTime,
    reviewReply: raw.reviewReply?.comment
      ? {
          comment: raw.reviewReply.comment,
          updateTime: raw.reviewReply.updateTime,
          reviewReplyState: parseReviewReplyState(raw.reviewReply.reviewReplyState),
          policyViolation: raw.reviewReply.policyViolation,
        }
      : undefined,
    mediaItems: (raw.reviewMediaItems ?? [])
      .map((item) => ({
        thumbnailUrl: item.thumbnailUrl ?? "",
        thumbnailLabel: item.thumbnailLabel,
        videoUrl: item.videoUrl,
      }))
      .filter((item) => Boolean(item.thumbnailUrl || item.videoUrl)),
  };
}

export function computeResponseTimeHours(
  createTime: string,
  replyUpdateTime?: string
): number | null {
  if (!replyUpdateTime) return null;
  const created = new Date(createTime).getTime();
  const replied = new Date(replyUpdateTime).getTime();
  if (Number.isNaN(created) || Number.isNaN(replied) || replied < created) return null;
  return Math.round((replied - created) / (1000 * 60 * 60));
}

export function isReviewResponded(review: GbpReview): boolean {
  return Boolean(review.reviewReply?.comment);
}

/** accounts.locations.reviews.list — paginated, full field set. */
export async function listGbpReviews(
  connection: GbpConnection,
  options?: { maxReviews?: number }
): Promise<GbpReview[]> {
  const maxReviews = options?.maxReviews ?? 500;
  const reviews: GbpReview[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(reviewsBase(connection));
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: authHeadersForConnection(connection),
    });

    const data = (await res.json()) as {
      reviews?: ReviewApi[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      await throwApiError(res, data, "Reviews API failed");
    }

    for (const review of data.reviews ?? []) {
      reviews.push(parseGbpReview(review, reviews.length));
    }

    pageToken = data.nextPageToken;
  } while (pageToken && reviews.length < maxReviews);

  return reviews;
}

/** accounts.locations.reviews.get */
export async function getGbpReview(
  connection: GbpConnection,
  reviewId: string
): Promise<GbpReview> {
  const url = `${reviewsBase(connection)}/${reviewId}`;

  const res = await fetch(url, { headers: authHeadersForConnection(connection) });
  const data = (await res.json()) as ReviewApi & { error?: { message?: string } };

  if (!res.ok) {
    await throwApiError(res, data, "Review fetch failed");
  }

  return parseGbpReview(data);
}

export interface ReviewReplyResult {
  reviewId: string;
  comment: string;
  updateTime?: string;
  reviewReplyState?: ReviewReplyState;
  policyViolation?: string;
}

/** accounts.locations.reviews.updateReply */
export async function applyReviewReply(
  connection: GbpConnection,
  reviewId: string,
  comment: string
): Promise<ReviewReplyResult> {
  const url = `${reviewsBase(connection)}/${reviewId}/reply`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment: comment.trim() }),
  });

  const data = (await res.json()) as {
    comment?: string;
    updateTime?: string;
    reviewReplyState?: string;
    policyViolation?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    await throwApiError(res, data, "Failed to post review reply");
  }

  return {
    reviewId,
    comment: data.comment ?? comment.trim(),
    updateTime: data.updateTime,
    reviewReplyState: parseReviewReplyState(data.reviewReplyState),
    policyViolation: data.policyViolation,
  };
}

/** accounts.locations.reviews.deleteReply */
export async function deleteReviewReply(
  connection: GbpConnection,
  reviewId: string
): Promise<void> {
  const url = `${reviewsBase(connection)}/${reviewId}/reply`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeadersForConnection(connection),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    await throwApiError(res, data, "Failed to delete review reply");
  }
}

async function probeEndpoint(probe: () => Promise<unknown>): Promise<ReviewEndpointStatus> {
  try {
    await probe();
    return "ok";
  } catch (error) {
    return endpointStatusFromError(error);
  }
}

/** Quick health check for settings and onboarding. */
export async function probeReviewsApiAccess(
  connection: GbpConnection
): Promise<ReviewsApiProbe> {
  const endpoints = {
    list: await probeEndpoint(() => listGbpReviews(connection, { maxReviews: 5 })),
    get: "skipped" as ReviewEndpointStatus,
  };

  if (endpoints.list !== "ok") {
    return {
      ok: false,
      permissionDenied: endpoints.list === "denied",
      error:
        endpoints.list === "denied"
          ? "Reviews API access denied for this location."
          : "Reviews API unavailable for this location.",
      endpoints,
    };
  }

  try {
    const reviews = await listGbpReviews(connection, { maxReviews: 100 });
    if (reviews.length > 0) {
      endpoints.get = await probeEndpoint(() => getGbpReview(connection, reviews[0].reviewId));
    }

    const coverage = analyzeGbpReviewCoverage({ reviews, probe: { endpoints } });
    const averageRating =
      reviews.length > 0
        ? Math.round(
            (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10
          ) / 10
        : 0;

    return {
      ok: true,
      permissionDenied: false,
      partial: endpoints.get !== "ok" && reviews.length > 0,
      reviewCount: reviews.length,
      averageRating,
      endpoints,
      coverage,
    };
  } catch (error) {
    return {
      ok: false,
      permissionDenied: endpointStatusFromError(error) === "denied",
      error: error instanceof Error ? error.message : "Reviews API probe failed",
      endpoints,
    };
  }
}

export const REVIEWS_METHODS = [
  "accounts.locations.reviews.list",
  "accounts.locations.reviews.get",
  "accounts.locations.reviews.updateReply",
  "accounts.locations.reviews.deleteReply",
] as const;

export const STAR_RATINGS: GbpStarRating[] = ["ONE", "TWO", "THREE", "FOUR", "FIVE"];

export function formatPolicyViolation(code?: string): string {
  if (!code || code === "POLICY_VIOLATION_UNSPECIFIED") return "";
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function formatReplyState(state?: ReviewReplyState): string {
  switch (state) {
    case "APPROVED":
      return "Published";
    case "PENDING":
      return "Pending review";
    case "REJECTED":
      return "Rejected";
    default:
      return "Unknown";
  }
}
