import type { ClientConfig, GbpSnapshot } from "../types";
import { isGoogleBusinessApiConfigured } from "@/lib/google/business-config";
import { fetchGbpEnrichment } from "@/lib/google/business-profile";
import {
  fetchPlaceDetails,
  primaryCategoryFromTypes,
  secondaryCategoriesFromTypes,
} from "@/lib/google/place-details";

function completenessScore(fields: boolean[]): number {
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function reviewsSince(reviews: Array<{ createTime: string }>, days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return reviews.filter((r) => new Date(r.createTime).getTime() >= cutoff).length;
}

/**
 * Collects Google Business Profile snapshot.
 * Uses Places Details (API key + place_id) and optional GBP OAuth APIs.
 */
export async function collectGbpSnapshot(client: ClientConfig): Promise<GbpSnapshot> {
  const useLiveApi = Boolean(client.gbpPlaceId && isGoogleBusinessApiConfigured());

  if (useLiveApi) {
    try {
      return await collectGbpFromApi(client);
    } catch (error) {
      console.error("[gbp] Live API failed, falling back to demo data:", error);
    }
  }

  return collectGbpDemo(client);
}

async function collectGbpFromApi(client: ClientConfig): Promise<GbpSnapshot> {
  const placeId = client.gbpPlaceId!;
  const now = new Date().toISOString();

  const [place, enrichment] = await Promise.all([
    fetchPlaceDetails(placeId),
    fetchGbpEnrichment(),
  ]);

  const description = place.description;
  const hasDescription = description.length > 0;
  const hasServices = false;
  const serviceCount = 0;

  const posts = enrichment?.posts ?? [];
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
  );
  const lastPostDate = sortedPosts[0]?.createTime ?? null;

  const questions = enrichment?.questions ?? [];
  const unansweredQa = questions.filter((q) => q.answerCount === 0).length;

  const gbpReviews = enrichment?.reviews ?? [];
  const respondedReviews = gbpReviews.filter((r) => r.reviewReply);
  const responseRate =
    gbpReviews.length > 0 ? respondedReviews.length / gbpReviews.length : 0;

  const performance = enrichment?.performance ?? {
    calls: 0,
    directionRequests: 0,
    websiteClicks: 0,
    periodDays: 30,
  };

  const isSuspended = place.businessStatus === "CLOSED_PERMANENTLY";
  const isVerified = place.isOperational;

  const napInconsistencies: string[] = [];
  if (client.phone && place.phone && !phonesMatch(client.phone, place.phone)) {
    napInconsistencies.push("Phone mismatch between client config and GBP");
  }

  return {
    collectedAt: now,
    identity: {
      name: place.name || client.name,
      address: place.address,
      phone: place.phone || client.phone || "",
      website: place.website || client.website || "",
      primaryCategory: primaryCategoryFromTypes(place.types) || client.industry,
      secondaryCategories: secondaryCategoriesFromTypes(place.types),
    },
    completeness: {
      hasHours: place.hasHours,
      hasHolidayHours: place.hasHolidayHours,
      hasDescription,
      descriptionLength: description.length,
      hasServices,
      serviceCount,
      attributeCount: 0,
      completenessScore: completenessScore([
        place.hasHours,
        place.hasHolidayHours,
        hasDescription,
        hasServices,
        place.photoCount > 0,
        Boolean(place.website),
      ]),
    },
    content: {
      photoCount: place.photoCount,
      photosByType: { all: place.photoCount },
      lastPhotoUpload: null,
      postCount: posts.length,
      lastPostDate,
      qaCount: questions.length,
      unansweredQa,
    },
    engagement: {
      reviewCount: place.reviewCount,
      averageRating: place.rating ?? 0,
      reviewsLast30Days: gbpReviews.length
        ? reviewsSince(gbpReviews, 30)
        : reviewsSince(
            place.reviews.map((r) => ({ createTime: r.publishedAt })),
            30
          ),
      reviewsLast90Days: gbpReviews.length
        ? reviewsSince(gbpReviews, 90)
        : reviewsSince(
            place.reviews.map((r) => ({ createTime: r.publishedAt })),
            90
          ),
      responseRate,
      avgResponseTimeHours: 0,
    },
    performance: {
      calls: performance.calls,
      directionRequests: performance.directionRequests,
      websiteClicks: performance.websiteClicks,
      periodDays: performance.periodDays,
    },
    issues: {
      isSuspended,
      isVerified,
      hasDuplicateListings: false,
      napInconsistencies,
    },
  };
}

function phonesMatch(a: string, b: string): boolean {
  const digits = (s: string) => s.replace(/\D/g, "");
  return digits(a).endsWith(digits(b).slice(-10)) || digits(b).endsWith(digits(a).slice(-10));
}

function collectGbpDemo(client: ClientConfig): GbpSnapshot {
  const now = new Date().toISOString();
  const hasDescription = true;
  const hasServices = true;
  const hasHours = true;

  return {
    collectedAt: now,
    identity: {
      name: client.name,
      address: `${client.location.address}, ${client.location.city}, ${client.location.state} ${client.location.zip}`,
      phone: client.phone ?? "",
      website: client.website ?? "",
      primaryCategory: client.industry,
      secondaryCategories: ["Plasterer", "Masonry contractor"],
    },
    completeness: {
      hasHours,
      hasHolidayHours: false,
      hasDescription,
      descriptionLength: 420,
      hasServices,
      serviceCount: 8,
      attributeCount: 6,
      completenessScore: completenessScore([
        hasHours,
        false,
        hasDescription,
        hasServices,
        true,
        true,
      ]),
    },
    content: {
      photoCount: 34,
      photosByType: { exterior: 12, team: 8, projects: 14 },
      lastPhotoUpload: daysAgoIso(21),
      postCount: 6,
      lastPostDate: daysAgoIso(18),
      qaCount: 4,
      unansweredQa: 1,
    },
    engagement: {
      reviewCount: 47,
      averageRating: 4.6,
      reviewsLast30Days: 3,
      reviewsLast90Days: 11,
      responseRate: 0.89,
      avgResponseTimeHours: 14,
    },
    performance: {
      calls: 38,
      directionRequests: 52,
      websiteClicks: 71,
      periodDays: 30,
    },
    issues: {
      isSuspended: false,
      isVerified: true,
      hasDuplicateListings: false,
      napInconsistencies: [],
    },
  };
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
