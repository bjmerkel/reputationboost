import type { GbpConnection } from "@/audit/types";
import {
  fetchGbpPerformanceData,
  type GbpPerformanceData,
} from "./gbp-performance";
import { fetchGbpMediaSummary, type GbpMediaSummary } from "./gbp-media";
import { listGbpLocalPosts, type GbpLocalPost } from "./gbp-local-posts";
import { listGbpReviews, type GbpReview } from "./gbp-reviews";
import { authHeadersForConnection } from "./token-store";

export type { GbpReview } from "./gbp-reviews";
export type { GbpLocalPost } from "./gbp-local-posts";

export type GbpPerformanceMetrics = GbpPerformanceData;
export interface GbpEnrichment {
  performance: GbpPerformanceMetrics;
  posts: GbpLocalPost[];
  postsApiOk: boolean;
  reviews: GbpReview[];
  reviewsApiOk: boolean;
  questions: GbpQuestion[];
  media: GbpMediaSummary;
}

export interface GbpQuestion {
  text: string;
  answerCount: number;
  topAnswer?: string;
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

/** Full GBP management data using per-business OAuth connection. */
export async function fetchGbpEnrichment(
  connection: GbpConnection,
  options?: { userEmail?: string }
): Promise<GbpEnrichment> {
  let postsApiOk = false;
  const postsPromise = listGbpLocalPosts(connection)
    .then((items) => {
      postsApiOk = true;
      return items;
    })
    .catch(() => [] as GbpLocalPost[]);

  let reviewsApiOk = false;
  const reviewsPromise = listGbpReviews(connection)
    .then((items) => {
      reviewsApiOk = true;
      return items;
    })
    .catch(() => [] as GbpReview[]);

  const [performance, posts, reviews, questions, media] = await Promise.all([
    fetchGbpPerformanceData(connection, 30, { platformEmail: options?.userEmail }),
    postsPromise,
    reviewsPromise,
    fetchQuestions(connection).catch(() => []),
    fetchGbpMediaSummary(connection).catch(() => ({
      photoCount: 0,
      videoCount: 0,
      photosByType: {},
      lastPhotoUpload: null,
      totalMediaItemCount: 0,
      items: [],
    })),
  ]);

  return { performance, posts, postsApiOk, reviews, reviewsApiOk, questions, media };
}
