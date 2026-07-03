import type { ClientConfig, GbpConnection, GbpSnapshot } from "../types";
import { isGoogleBusinessApiConfigured } from "@/lib/google/business-config";
import { fetchGbpEnrichment } from "@/lib/google/business-profile";
import { getGbpLocationProfile } from "@/lib/google/gbp-location";
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
 * Collects Google Business Profile snapshot from OAuth-connected GBP APIs.
 */
export async function collectGbpSnapshot(
  client: ClientConfig,
  connection?: GbpConnection | null
): Promise<GbpSnapshot> {
  if (connection) {
    return collectGbpFromApi(client, connection);
  }

  if (client.gbpPlaceId && isGoogleBusinessApiConfigured()) {
    return collectGbpFromPlaceDetails(client);
  }

  throw new Error(
    "GBP not connected. Complete onboarding and connect your Google Business Profile."
  );
}

async function collectGbpFromApi(
  client: ClientConfig,
  connection: GbpConnection
): Promise<GbpSnapshot> {
  const now = new Date().toISOString();

  const [enrichment, liveProfileResult, place] = await Promise.all([
    fetchGbpEnrichment(connection),
    getGbpLocationProfile(connection).catch(() => null),
    (connection.placeId ?? client.gbpPlaceId)
      ? fetchPlaceDetails(connection.placeId ?? client.gbpPlaceId!).catch(() => null)
      : Promise.resolve(null),
  ]);

  const liveProfile = liveProfileResult;
  const description =
    liveProfile?.description || place?.description || "";
  const hasDescription = description.length > 0;
  const posts = enrichment.posts;
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
  );
  const questions = enrichment.questions;
  const gbpReviews = enrichment.reviews;
  const respondedReviews = gbpReviews.filter((r) => r.reviewReply);
  const responseRate =
    gbpReviews.length > 0 ? respondedReviews.length / gbpReviews.length : 0;
  const performance = enrichment.performance;

  const primaryCategory =
    liveProfile?.primaryCategory?.displayName ||
    primaryCategoryFromTypes(place?.types ?? []) ||
    client.industry;
  const secondaryCategories = liveProfile?.additionalCategories.length
    ? liveProfile.additionalCategories.map((c) => c.displayName)
    : secondaryCategoriesFromTypes(place?.types ?? []);

  const serviceItems = liveProfile?.serviceItems ?? [];
  const attributes = liveProfile?.attributes ?? [];
  const hasHours = liveProfile?.hasRegularHours ?? place?.hasHours ?? false;
  const hasHolidayHours = liveProfile?.hasMoreHours ?? place?.hasHolidayHours ?? false;

  const name = liveProfile?.title || place?.name || client.name;
  const address = place?.address || formatAddress(client);
  const phone = place?.phone || client.phone || "";
  const website = place?.website || client.website || "";

  return {
    collectedAt: now,
    identity: {
      name,
      address,
      phone,
      website,
      primaryCategory,
      secondaryCategories,
    },
    completeness: {
      hasHours,
      hasHolidayHours,
      hasDescription,
      descriptionLength: description.length,
      hasServices: serviceItems.length > 0,
      serviceCount: serviceItems.length,
      attributeCount: attributes.length,
      completenessScore: completenessScore([
        hasHours,
        hasHolidayHours,
        hasDescription,
        serviceItems.length > 0,
        (place?.photoCount ?? 0) > 0,
        Boolean(website),
      ]),
    },
    content: {
      photoCount: place?.photoCount ?? 0,
      photosByType: { all: place?.photoCount ?? 0 },
      lastPhotoUpload: null,
      postCount: posts.length,
      lastPostDate: sortedPosts[0]?.createTime ?? null,
      qaCount: questions.length,
      unansweredQa: questions.filter((q) => q.answerCount === 0).length,
    },
    engagement: {
      reviewCount: place?.reviewCount ?? gbpReviews.length,
      averageRating: place?.rating ?? averageRating(gbpReviews),
      reviewsLast30Days: reviewsSince(gbpReviews, 30),
      reviewsLast90Days: reviewsSince(gbpReviews, 90),
      responseRate,
      avgResponseTimeHours: 0,
    },
    performance: {
      calls: performance.calls,
      directionRequests: performance.directionRequests,
      websiteClicks: performance.websiteClicks,
      profileViews: performance.profileViews,
      impressionsMaps: performance.impressionsMaps,
      impressionsSearch: performance.impressionsSearch,
      conversations: performance.conversations,
      bookings: performance.bookings,
      periodDays: performance.periodDays,
      searchKeywords: performance.searchKeywords,
      source: performance.source,
      error: performance.error,
    },
    issues: {
      isSuspended: place?.businessStatus === "CLOSED_PERMANENTLY",
      isVerified: place?.isOperational ?? true,
      hasDuplicateListings: false,
      napInconsistencies: [],
    },
    liveProfile: {
      primaryCategory,
      secondaryCategories,
      description,
      services: serviceItems,
      attributes,
      source: liveProfile ? "oauth" : "places",
    },
    recentPosts: sortedPosts.slice(0, 5).map((p) => ({
      createTime: p.createTime,
      summary: p.summary,
    })),
    qaItems: questions.slice(0, 10).map((q) => ({
      question: q.text,
      answerCount: q.answerCount,
      topAnswer: q.topAnswer,
    })),
  };
}

async function collectGbpFromPlaceDetails(client: ClientConfig): Promise<GbpSnapshot> {
  const place = await fetchPlaceDetails(client.gbpPlaceId!);
  const now = new Date().toISOString();
  const description = place.description;

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
      hasDescription: description.length > 0,
      descriptionLength: description.length,
      hasServices: false,
      serviceCount: 0,
      attributeCount: 0,
      completenessScore: completenessScore([
        place.hasHours,
        place.hasHolidayHours,
        description.length > 0,
        false,
        place.photoCount > 0,
        Boolean(place.website),
      ]),
    },
    content: {
      photoCount: place.photoCount,
      photosByType: { all: place.photoCount },
      lastPhotoUpload: null,
      postCount: 0,
      lastPostDate: null,
      qaCount: 0,
      unansweredQa: 0,
    },
    engagement: {
      reviewCount: place.reviewCount,
      averageRating: place.rating ?? 0,
      reviewsLast30Days: 0,
      reviewsLast90Days: 0,
      responseRate: 0,
      avgResponseTimeHours: 0,
    },
    performance: {
      calls: 0,
      directionRequests: 0,
      websiteClicks: 0,
      profileViews: 0,
      impressionsMaps: 0,
      impressionsSearch: 0,
      conversations: 0,
      bookings: 0,
      periodDays: 30,
      source: "unavailable",
    },
    issues: {
      isSuspended: place.businessStatus === "CLOSED_PERMANENTLY",
      isVerified: place.isOperational,
      hasDuplicateListings: false,
      napInconsistencies: [],
    },
    liveProfile: {
      primaryCategory: primaryCategoryFromTypes(place.types) || client.industry,
      secondaryCategories: secondaryCategoriesFromTypes(place.types),
      description,
      services: [],
      attributes: [],
      source: "places",
    },
    recentPosts: [],
    qaItems: [],
  };
}

function formatAddress(client: ClientConfig): string {
  const { address, city, state, zip } = client.location;
  return `${address}, ${city}, ${state} ${zip}`;
}

function averageRating(reviews: Array<{ rating: number }>): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((a, r) => a + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}
