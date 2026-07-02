import type { ClientConfig, GbpConnection, ReviewRecord, ReviewSnapshot } from "../types";
import { fetchGbpEnrichment } from "@/lib/google/business-profile";
import { fetchPlaceDetails } from "@/lib/google/place-details";

export async function collectReviewSnapshot(
  client: ClientConfig,
  connection?: GbpConnection | null
): Promise<ReviewSnapshot> {
  if (connection) {
    return collectReviewsFromApi(client, connection);
  }

  if (client.gbpPlaceId) {
    return collectReviewsFromPlaceDetails(client);
  }

  throw new Error(
    "GBP not connected. Complete onboarding and connect your Google Business Profile."
  );
}

async function collectReviewsFromApi(
  client: ClientConfig,
  connection: GbpConnection
): Promise<ReviewSnapshot> {
  const now = new Date().toISOString();
  const enrichment = await fetchGbpEnrichment(connection);
  const gbpReviews = enrichment.reviews;

  const reviews: ReviewRecord[] = gbpReviews.map((r) => ({
    id: r.reviewId,
    rating: r.rating,
    text: r.comment,
    author: r.reviewer,
    publishedAt: r.createTime,
    responded: Boolean(r.reviewReply),
    responseTimeHours: null,
    sentiment: ratingToSentiment(r.rating),
  }));

  return buildReviewSnapshot(now, reviews);
}

async function collectReviewsFromPlaceDetails(client: ClientConfig): Promise<ReviewSnapshot> {
  const now = new Date().toISOString();
  const place = await fetchPlaceDetails(client.gbpPlaceId!);

  const reviews: ReviewRecord[] = place.reviews.map((r, i) => ({
    id: `place-review-${i}`,
    rating: r.rating,
    text: r.text,
    author: r.authorName,
    publishedAt: r.publishedAt,
    responded: false,
    responseTimeHours: null,
    sentiment: ratingToSentiment(r.rating),
  }));

  return buildReviewSnapshot(now, reviews);
}

function buildReviewSnapshot(now: string, reviews: ReviewRecord[]): ReviewSnapshot {
  const positiveThemes = extractThemes(
    reviews.filter((r) => r.sentiment === "positive").map((r) => r.text)
  );
  const negativeThemes = extractThemes(
    reviews.filter((r) => r.sentiment === "negative").map((r) => r.text)
  );

  const unrespondedNegative = reviews.filter((r) => r.rating <= 3 && !r.responded).length;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const velocityVsPriorMonth = reviews.filter(
    (r) => new Date(r.publishedAt).getTime() >= thirtyDaysAgo
  ).length;

  return {
    collectedAt: now,
    reviews,
    sentiment: {
      positiveThemes,
      negativeThemes,
      praiseCount: reviews.filter((r) => r.sentiment === "positive").length,
      complaintCount: reviews.filter((r) => r.sentiment === "negative").length,
      neutralCount: reviews.filter((r) => r.sentiment === "neutral").length,
    },
    unrespondedNegative,
    disputeCandidates: reviews.filter((r) => r.rating <= 2 && !r.responded).map((r) => r.id),
    velocityVsPriorMonth,
  };
}

function ratingToSentiment(rating: number): ReviewRecord["sentiment"] {
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

const THEME_KEYWORDS: Record<string, string[]> = {
  "quality work": ["quality", "excellent", "great job", "professional"],
  "fair pricing": ["fair", "price", "affordable", "value"],
  "good communication": ["communication", "responsive", "reachable", "phone"],
  "scheduling delays": ["late", "delay", "schedule", "wait"],
  "hard to reach": ["reach", "callback", "no answer", "unresponsive"],
};

function extractThemes(texts: string[]): string[] {
  const joined = texts.join(" ").toLowerCase();
  return Object.entries(THEME_KEYWORDS)
    .filter(([, keywords]) => keywords.some((kw) => joined.includes(kw)))
    .map(([theme]) => theme)
    .slice(0, 4);
}
