import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";

const GBP_V4 = "https://mybusiness.googleapis.com/v4";

export type ReviewReplyState =
  | "REVIEW_REPLY_STATE_UNSPECIFIED"
  | "PENDING"
  | "REJECTED"
  | "APPROVED";

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

function reviewsBase(connection: GbpConnection): string {
  return `${GBP_V4}/accounts/${connection.accountId}/locations/${connection.locationId}/reviews`;
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
      throw new Error(data.error?.message ?? `Reviews API failed (${res.status})`);
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
    throw new Error(data.error?.message ?? `Review fetch failed (${res.status})`);
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
    throw new Error(data.error?.message ?? `Failed to post review reply (${res.status})`);
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
    throw new Error(data.error?.message ?? `Failed to delete review reply (${res.status})`);
  }
}

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
