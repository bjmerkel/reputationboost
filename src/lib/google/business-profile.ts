import type { GbpConnection } from "@/audit/types";
import {
  fetchGbpPerformanceData,
  type GbpPerformanceData,
} from "./gbp-performance";
import { fetchGbpMediaSummary, type GbpMediaSummary } from "./gbp-media";
import { listGbpReviews, type GbpReview } from "./gbp-reviews";
import { authHeadersForConnection } from "./token-store";

export type { GbpReview } from "./gbp-reviews";

export type GbpPerformanceMetrics = GbpPerformanceData;
export interface GbpEnrichment {
  performance: GbpPerformanceMetrics;
  posts: GbpLocalPost[];
  questions: GbpQuestion[];
  reviews: GbpReview[];
  media: GbpMediaSummary;
}

export interface GbpLocalPost {
  createTime: string;
  summary: string;
}

export interface GbpQuestion {
  text: string;
  answerCount: number;
  topAnswer?: string;
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

/** Full GBP management data using per-business OAuth connection. */
export async function fetchGbpEnrichment(
  connection: GbpConnection,
  options?: { userEmail?: string }
): Promise<GbpEnrichment> {
  const [performance, posts, questions, reviews, media] = await Promise.all([
    fetchGbpPerformanceData(connection, 30, { platformEmail: options?.userEmail }),
    fetchLocalPosts(connection).catch(() => []),
    fetchQuestions(connection).catch(() => []),
    listGbpReviews(connection).catch(() => []),
    fetchGbpMediaSummary(connection).catch(() => ({
      photoCount: 0,
      videoCount: 0,
      photosByType: {},
      lastPhotoUpload: null,
      items: [],
    })),
  ]);

  return { performance, posts, questions, reviews, media };
}
