import {
  getGbpAccessToken,
  getGbpAccountId,
  getGbpLocationId,
  isGbpOAuthConfigured,
} from "./business-config";

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

function authHeaders(): HeadersInit {
  const token = getGbpAccessToken();
  if (!token) throw new Error("GOOGLE_BUSINESS_ACCESS_TOKEN is not configured.");
  return { Authorization: `Bearer ${token}` };
}

/**
 * Business Profile Performance API — requires OAuth + location ID.
 * https://developers.google.com/my-business/reference/performance/rest
 */
async function fetchPerformanceMetrics(
  locationId: string,
  periodDays = 30
): Promise<GbpPerformanceMetrics> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);

  const url = new URL(
    `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`
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

  const res = await fetch(url.toString(), { headers: authHeaders() });
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

/** Local posts via Business Profile API v4. */
async function fetchLocalPosts(accountId: string, locationId: string): Promise<GbpLocalPost[]> {
  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;
  const res = await fetch(url, { headers: authHeaders() });
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

/** Q&A via Business Profile Q&A API. */
async function fetchQuestions(locationId: string): Promise<GbpQuestion[]> {
  const url = `https://mybusinessqanda.googleapis.com/v1/locations/${locationId}/questions`;
  const res = await fetch(url, { headers: authHeaders() });
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

/** Reviews via Business Profile API v4 (full list with replies). */
async function fetchGbpReviews(accountId: string, locationId: string): Promise<GbpReview[]> {
  const reviews: GbpReview[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`
    );
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { headers: authHeaders() });
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

/**
 * Optional OAuth enrichment from Business Profile APIs.
 * Requires GOOGLE_BUSINESS_ACCESS_TOKEN, GOOGLE_BUSINESS_LOCATION_ID,
 * and GOOGLE_BUSINESS_ACCOUNT_ID (for posts/reviews).
 */
export async function fetchGbpEnrichment(): Promise<GbpEnrichment | null> {
  if (!isGbpOAuthConfigured()) return null;

  const locationId = getGbpLocationId()!;
  const accountId = getGbpAccountId();

  const [performance, posts, questions, reviews] = await Promise.all([
    fetchPerformanceMetrics(locationId).catch(() => null),
    accountId ? fetchLocalPosts(accountId, locationId).catch(() => []) : Promise.resolve([]),
    fetchQuestions(locationId).catch(() => []),
    accountId ? fetchGbpReviews(accountId, locationId).catch(() => []) : Promise.resolve([]),
  ]);

  return { performance, posts, questions, reviews };
}
