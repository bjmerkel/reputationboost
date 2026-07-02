import type { ClientConfig, ReviewRecord, ReviewSnapshot } from "../types";

/**
 * Collects reviews, sentiment themes, and dispute candidates.
 */
export async function collectReviewSnapshot(
  client: ClientConfig
): Promise<ReviewSnapshot> {
  if (process.env.GOOGLE_BUSINESS_API_KEY && client.gbpPlaceId) {
    return collectReviewsFromApi(client);
  }
  return collectReviewsDemo(client);
}

async function collectReviewsFromApi(client: ClientConfig): Promise<ReviewSnapshot> {
  void client;
  throw new Error(
    "Live review collector pending. Wire to GBP Reviews API in collectReviewsFromApi."
  );
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
