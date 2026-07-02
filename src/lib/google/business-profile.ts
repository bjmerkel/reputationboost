import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./token-store";

export interface GbpPerformanceMetrics {
  calls: number;
  directionRequests: number;
  websiteClicks: number;
  periodDays: number;
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

export interface GbpReview {
  reviewId: string;
  reviewer: string;
  rating: number;
  comment: string;
  createTime: string;
  reviewReply?: string;
}

export interface GbpEnrichment {
  performance: GbpPerformanceMetrics | null;
  posts: GbpLocalPost[];
  questions: GbpQuestion[];
  reviews: GbpReview[];
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function dateParts(d: Date): DateParts {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

async function fetchPerformanceMetrics(
  connection: GbpConnection,
  periodDays = 30
): Promise<GbpPerformanceMetrics> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);

  const url = new URL(
    `https://businessprofileperformance.googleapis.com/v1/locations/${connection.locationId}:fetchMultiDailyMetricsTimeSeries`
  );

  for (const metric of ["CALL_CLICKS", "BUSINESS_DIRECTION_REQUESTS", "WEBSITE_CLICKS"]) {
    url.searchParams.append("dailyMetrics", metric);
  }

  const startParts = dateParts(start);
  const endParts = dateParts(end);
  url.searchParams.set("dailyRange.start_date.year", String(startParts.year));
  url.searchParams.set("dailyRange.start_date.month", String(startParts.month));
  url.searchParams.set("dailyRange.start_date.day", String(startParts.day));
  url.searchParams.set("dailyRange.end_date.year", String(endParts.year));
  url.searchParams.set("dailyRange.end_date.month", String(endParts.month));
  url.searchParams.set("dailyRange.end_date.day", String(endParts.day));

  const res = await fetch(url.toString(), { headers: authHeadersForConnection(connection) });
  const data = (await res.json()) as {
    multiDailyMetricTimeSeries?: Array<{
      dailyMetricTimeSeries?: Array<{
        dailyMetric?: string;
        timeSeries?: { datedValues?: Array<{ value?: string }> };
      }>;
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Performance API failed (${res.status})`);
  }

  const series = data.multiDailyMetricTimeSeries?.[0]?.dailyMetricTimeSeries ?? [];

  function sumTimeSeries(metric: string): number {
    const entry = series.find((s) => s.dailyMetric === metric);
    const values = entry?.timeSeries?.datedValues ?? [];
    return values.reduce((sum, dv) => sum + Number(dv.value ?? 0), 0);
  }

  return {
    calls: sumTimeSeries("CALL_CLICKS"),
    directionRequests: sumTimeSeries("BUSINESS_DIRECTION_REQUESTS"),
    websiteClicks: sumTimeSeries("WEBSITE_CLICKS"),
    periodDays,
  };
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
  connection: GbpConnection
): Promise<GbpEnrichment> {
  const [performance, posts, questions, reviews] = await Promise.all([
    fetchPerformanceMetrics(connection).catch(() => null),
    fetchLocalPosts(connection).catch(() => []),
    fetchQuestions(connection).catch(() => []),
    fetchGbpReviews(connection).catch(() => []),
  ]);

  return { performance, posts, questions, reviews };
}
