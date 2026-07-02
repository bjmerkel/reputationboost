import type { ClientConfig, ReviewRecord, ReviewSnapshot } from "../types";
import { isGoogleBusinessApiConfigured } from "@/lib/google/business-config";
import { fetchGbpEnrichment } from "@/lib/google/business-profile";
import { fetchPlaceDetails } from "@/lib/google/place-details";

/**
 * Collects reviews, sentiment themes, and dispute candidates.
 */
export async function collectReviewSnapshot(
  client: ClientConfig
): Promise<ReviewSnapshot> {
  if (client.gbpPlaceId && isGoogleBusinessApiConfigured()) {
    try {
      return await collectReviewsFromApi(client);
    } catch (error) {
      console.error("[reviews] Live API failed, falling back to demo data:", error);
    }
  }
  return collectReviewsDemo(client);
}

async function collectReviewsFromApi(client: ClientConfig): Promise<ReviewSnapshot> {
  const now = new Date().toISOString();
  const enrichment = await fetchGbpEnrichment();
  const place = await fetchPlaceDetails(client.gbpPlaceId!);

  const sourceReviews =
    enrichment?.reviews && enrichment.reviews.length > 0
      ? enrichment.reviews.map((r) => ({
          id: r.reviewId,
          rating: r.rating,
          text: r.comment,
          author: r.reviewer,
          publishedAt: r.createTime,
          responded: Boolean(r.reviewReply),
          responseTimeHours: null as number | null,
        }))
      : place.reviews.map((r, i) => ({
          id: `place-review-${i}`,
          rating: r.rating,
          text: r.text,
          author: r.authorName,
          publishedAt: r.publishedAt,
          responded: false,
          responseTimeHours: null as number | null,
        }));

  const reviews: ReviewRecord[] = sourceReviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    author: r.author,
    publishedAt: r.publishedAt,
    responded: r.responded,
    responseTimeHours: r.responseTimeHours,
    sentiment: ratingToSentiment(r.rating),
  }));

  const positiveThemes = extractThemes(
    reviews.filter((r) => r.sentiment === "positive").map((r) => r.text)
  );
  const negativeThemes = extractThemes(
    reviews.filter((r) => r.sentiment === "negative").map((r) => r.text)
  );

  const unrespondedNegative = reviews.filter(
    (r) => r.rating <= 3 && !r.responded
  ).length;

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
    disputeCandidates: reviews
      .filter((r) => r.rating <= 2 && !r.responded)
      .map((r) => r.id),
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

function collectReviewsDemo(client: ClientConfig): ReviewSnapshot {
  void client;
  const now = new Date().toISOString();

  const reviews: ReviewRecord[] = [
    {
      id: "rev-001",
      rating: 5,
      text: "Outstanding stucco repair on our La Jolla home. Crew was professional and finished ahead of schedule.",
      author: "Maria G.",
      publishedAt: daysAgo(4),
      responded: true,
      responseTimeHours: 6,
      sentiment: "positive",
    },
    {
      id: "rev-002",
      rating: 5,
      text: "Best exterior plaster work in San Diego. Fair pricing and great communication throughout.",
      author: "James T.",
      publishedAt: daysAgo(12),
      responded: true,
      responseTimeHours: 10,
      sentiment: "positive",
    },
    {
      id: "rev-003",
      rating: 2,
      text: "Project took longer than quoted. Finish quality was good but scheduling was frustrating.",
      author: "Robert K.",
      publishedAt: daysAgo(8),
      responded: false,
      responseTimeHours: null,
      sentiment: "negative",
    },
    {
      id: "rev-004",
      rating: 4,
      text: "Solid work on our stucco installation. Would recommend for residential projects.",
      author: "Linda P.",
      publishedAt: daysAgo(22),
      responded: true,
      responseTimeHours: 18,
      sentiment: "positive",
    },
    {
      id: "rev-005",
      rating: 3,
      text: "Average experience. Work was fine but hard to reach the office by phone.",
      author: "Chris M.",
      publishedAt: daysAgo(35),
      responded: true,
      responseTimeHours: 48,
      sentiment: "neutral",
    },
  ];

  const unrespondedNegative = reviews.filter(
    (r) => r.rating <= 3 && !r.responded
  ).length;

  return {
    collectedAt: now,
    reviews,
    sentiment: {
      positiveThemes: ["quality work", "professional crew", "fair pricing", "good communication"],
      negativeThemes: ["scheduling delays", "hard to reach by phone"],
      praiseCount: reviews.filter((r) => r.sentiment === "positive").length,
      complaintCount: reviews.filter((r) => r.sentiment === "negative").length,
      neutralCount: reviews.filter((r) => r.sentiment === "neutral").length,
    },
    unrespondedNegative,
    disputeCandidates: unrespondedNegative > 0 ? ["rev-003"] : [],
    velocityVsPriorMonth: 3,
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
