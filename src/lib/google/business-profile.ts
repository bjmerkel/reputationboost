import type { GbpConnection } from "@/audit/types";
import {
  fetchGbpPerformanceData,
  type GbpPerformanceData,
} from "./gbp-performance";
import { authHeadersForConnection } from "./token-store";

export type GbpPerformanceMetrics = GbpPerformanceData;

export interface GbpLocalPost {
  createTime: string;
  summary: string;
}

export interface GbpQuestion {
  text: string;
  answerCount: number;
  topAnswer?: string;
}

export interface GbpReview {
  reviewId: string;
  reviewer: string;
  rating: number;
  comment: string;
  createTime: string;
  reviewReply?: string;
}

export interface GbpEnrichment {
  performance: GbpPerformanceMetrics;
  posts: GbpLocalPost[];
  questions: GbpQuestion[];
  reviews: GbpReview[];
}

async function fetchLocalPosts(connection: GbpConnection): Promise<GbpLocalPost[]> {
  const url = `https://mybusiness.googleapis.com/v4/accounts/${connection.accountId}/locations/${connection.locationId}/localPosts`;
  const res = await fetch(url, { headers: authHeadersForConnection(connection) });
  const data = (await res.json()) as {
    localPosts?: Array<{ createTime?: string; summary?: string }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Local posts API failed (${res.status})`);
  }

  return (data.localPosts ?? []).map((post) => ({
    createTime: post.createTime ?? new Date().toISOString(),
    summary: post.summary ?? "",
  }));
}

async function fetchQuestions(connection: GbpConnection): Promise<GbpQuestion[]> {
  const url = `https://mybusinessqanda.googleapis.com/v1/locations/${connection.locationId}/questions`;
  const res = await fetch(url, { headers: authHeadersForConnection(connection) });
  const data = (await res.json()) as {
    questions?: Array<{
      text?: string;
      topAnswers?: Array<{ text?: string }>;
      totalAnswerCount?: number;
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Q&A API failed (${res.status})`);
  }

  return (data.questions ?? []).map((q) => ({
    text: q.text ?? "",
    answerCount: q.totalAnswerCount ?? 0,
    topAnswer: q.topAnswers?.[0]?.text,
  }));
}

async function fetchGbpReviews(connection: GbpConnection): Promise<GbpReview[]> {
  const reviews: GbpReview[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/accounts/${connection.accountId}/locations/${connection.locationId}/reviews`
    );
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { headers: authHeadersForConnection(connection) });
    const data = (await res.json()) as {
      reviews?: Array<{
        reviewId?: string;
        reviewer?: { displayName?: string };
        starRating?: string;
        comment?: string;
        createTime?: string;
        reviewReply?: { comment?: string };
      }>;
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(data.error?.message ?? `Reviews API failed (${res.status})`);
    }

    for (const review of data.reviews ?? []) {
      reviews.push({
        reviewId: review.reviewId ?? `review-${reviews.length}`,
        reviewer: review.reviewer?.displayName ?? "Anonymous",
        rating: starRatingToNumber(review.starRating),
        comment: review.comment ?? "",
        createTime: review.createTime ?? new Date().toISOString(),
        reviewReply: review.reviewReply?.comment,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken && reviews.length < 100);

  return reviews;
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

/** Full GBP management data using per-business OAuth connection. */
export async function fetchGbpEnrichment(
  connection: GbpConnection,
  options?: { userEmail?: string }
): Promise<GbpEnrichment> {
  const [performance, posts, questions, reviews] = await Promise.all([
    fetchGbpPerformanceData(connection, 30, { connectedEmail: options?.userEmail }),
    fetchLocalPosts(connection).catch(() => []),
    fetchQuestions(connection).catch(() => []),
    fetchGbpReviews(connection).catch(() => []),
  ]);

  return { performance, posts, questions, reviews };
}
