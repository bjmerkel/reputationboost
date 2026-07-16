import type { ClientConfig, GbpConnection, ReviewRecord, ReviewSnapshot } from "../types";
import { fetchGbpEnrichment } from "@/lib/google/business-profile";
import {
  computeResponseTimeHours,
  isReviewResponded,
  type GbpReview,
} from "@/lib/google/gbp-reviews";
import { analyzeGbpReviewCoverage } from "@/lib/google/gbp-reviews-coverage";
import { fetchPlaceDetails } from "@/lib/google/place-details";
import { isDisputeableReview } from "@/lib/review-disputes/candidates";

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

function mapGbpReviewToRecord(r: GbpReview): ReviewRecord {
  const reply = r.reviewReply;
  const responseTimeHours = computeResponseTimeHours(r.createTime, reply?.updateTime);

  return {
    id: r.reviewId,
    resourceName: r.name || undefined,
    rating: r.rating,
    text: r.comment,
    author: r.reviewer,
    authorPhotoUrl: r.reviewerPhotoUrl,
    isAnonymous: r.isAnonymous,
    publishedAt: r.createTime,
    updatedAt: r.updateTime,
    responded: isReviewResponded(r),
    replyText: reply?.comment,
    replyUpdatedAt: reply?.updateTime,
    replyState: reply?.reviewReplyState,
    policyViolation: reply?.policyViolation,
    responseTimeHours,
    sentiment: ratingToSentiment(r.rating),
    mediaItems: r.mediaItems.length ? r.mediaItems : undefined,
  };
}

async function collectReviewsFromApi(
  client: ClientConfig,
  connection: GbpConnection
): Promise<ReviewSnapshot> {
  const now = new Date().toISOString();
  const enrichment = await fetchGbpEnrichment(connection);
  const reviews = enrichment.reviews.map(mapGbpReviewToRecord);
  const coverage = analyzeGbpReviewCoverage({
    reviews: enrichment.reviews,
    probe: { endpoints: { list: enrichment.reviewsApiOk ? "ok" : "failed" } },
  });

  return { ...buildReviewSnapshot(now, reviews), coverage };
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

  const responseTimes = reviews
    .map((r) => r.responseTimeHours)
    .filter((h): h is number => h !== null);
  const avgResponseTimeHours =
    responseTimes.length > 0
      ? Math.round(
          (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10
        ) / 10
      : null;

  const pendingReplies = reviews.filter((r) => r.replyState === "PENDING").length;
  const rejectedReplies = reviews.filter((r) => r.replyState === "REJECTED").length;

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
    disputeCandidates: reviews.filter((r) => isDisputeableReview(r)).map((r) => r.id),
    velocityVsPriorMonth,
    avgResponseTimeHours,
    pendingReplies,
    rejectedReplies,
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
