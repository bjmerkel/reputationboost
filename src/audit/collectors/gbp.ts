import type { ClientConfig, GbpConnection, GbpSnapshot, GbpMediaPreview } from "../types";
import { computeGbpCompletenessScore } from "../completeness";
import { compareNap } from "@/lib/google/nap-drift";
import { isGoogleBusinessApiConfigured } from "@/lib/google/business-config";
import { isReviewResponded } from "@/lib/google/gbp-reviews";
import { analyzeGbpReviewCoverage } from "@/lib/google/gbp-reviews-coverage";
import { fetchGbpEnrichment } from "@/lib/google/business-profile";
import { analyzeGbpMediaCoverage } from "@/lib/google/gbp-media-coverage";
import { getGbpNotificationSetting } from "@/lib/google/gbp-notifications";
import { analyzeGbpNotificationCoverage } from "@/lib/google/gbp-notifications-coverage";
import {
  listGbpPlaceActionLinks,
  listGbpPlaceActionTypeMetadata,
  placeActionTypeLabel,
} from "@/lib/google/gbp-place-actions";
import { analyzeGbpPlaceActionCoverage } from "@/lib/google/gbp-place-actions-coverage";
import {
  listGbpLocalPosts,
  localPostActionLabel,
  reportGbpLocalPostInsights,
} from "@/lib/google/gbp-local-posts";
import { analyzeGbpLocalPostCoverage } from "@/lib/google/gbp-local-posts-coverage";
import {
  enrichGbpLocationProfile,
  fetchAllGoogleSuggestions,
  fetchGoogleUpdateState,
  getGbpEnabledAttributeLabels,
  getGbpLocationProfile,
} from "@/lib/google/gbp-location";
import { buildGbpLocationInventory } from "@/lib/google/gbp-location-inventory";
import {
  fetchPlaceDetails,
  primaryCategoryFromTypes,
  secondaryCategoriesFromTypes,
} from "@/lib/google/place-details";

function reviewsSince(reviews: Array<{ createTime: string }>, days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return reviews.filter((r) => new Date(r.createTime).getTime() >= cutoff).length;
}

function mediaPreviewsFromEnrichment(
  items: Array<{
    name: string;
    thumbnailUrl: string;
    googleUrl: string;
    mediaFormat: "PHOTO" | "VIDEO";
    category: string | null;
    description: string;
    viewCount: string;
    attribution?: { profileName?: string };
  }>,
  limit = 24
): GbpMediaPreview[] {
  return items
    .filter((item) => item.thumbnailUrl || item.googleUrl)
    .slice(0, limit)
    .map((item) => ({
      thumbnailUrl: item.thumbnailUrl || item.googleUrl,
      googleUrl: item.googleUrl || item.thumbnailUrl,
      mediaFormat: item.mediaFormat,
      category: item.category,
      description: item.description || undefined,
      name: item.name,
      viewCount: Number(item.viewCount || 0),
      isCustomerPhoto: Boolean(item.attribution?.profileName),
      attributionName: item.attribution?.profileName || undefined,
    }));
}

function mediaInventoryFromEnrichment(
  items: Array<{
    name: string;
    thumbnailUrl: string;
    googleUrl: string;
    mediaFormat: "PHOTO" | "VIDEO";
    category: string | null;
    description: string;
    viewCount: string;
    createTime: string;
    attribution?: { profileName?: string };
  }>
) {
  return items.map((item) => ({
    name: item.name,
    category: item.category,
    mediaFormat: item.mediaFormat,
    thumbnailUrl: item.thumbnailUrl || item.googleUrl,
    googleUrl: item.googleUrl || item.thumbnailUrl,
    viewCount: Number(item.viewCount || 0),
    isCustomerPhoto: Boolean(item.attribution?.profileName),
    attributionName: item.attribution?.profileName || undefined,
    createTime: item.createTime,
  }));
}

/**
 * Collects Google Business Profile snapshot from OAuth-connected GBP APIs.
 */
export async function collectGbpSnapshot(
  client: ClientConfig,
  connection?: GbpConnection | null,
  options?: { userEmail?: string }
): Promise<GbpSnapshot> {
  if (connection) {
    return collectGbpFromApi(client, connection, options);
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
  connection: GbpConnection,
  options?: { userEmail?: string }
): Promise<GbpSnapshot> {
  const now = new Date().toISOString();

  const [enrichment, liveProfileResult, place, notificationSetting, placeActionLinks, placeActionTypes] =
    await Promise.all([
    fetchGbpEnrichment(connection, { userEmail: options?.userEmail }),
    getGbpLocationProfile(connection)
      .then((profile) => enrichGbpLocationProfile(connection, profile))
      .catch(() => null),
    (connection.placeId ?? client.gbpPlaceId)
      ? fetchPlaceDetails(connection.placeId ?? client.gbpPlaceId!).catch(() => null)
      : Promise.resolve(null),
    getGbpNotificationSetting(connection).catch(() => null),
    listGbpPlaceActionLinks(connection).catch(() => []),
    listGbpPlaceActionTypeMetadata(connection).catch(() => []),
  ]);
  const notifications = analyzeGbpNotificationCoverage(notificationSetting);

  const attributeSummary = await getGbpEnabledAttributeLabels(connection, {
    profile: liveProfileResult,
  }).catch(() => ({ labels: [], details: [] }));

  const googleSuggestions = liveProfileResult
    ? await fetchAllGoogleSuggestions(connection, liveProfileResult).catch(() => [])
    : [];
  const googleUpdateState =
    liveProfileResult &&
    (liveProfileResult.hasGoogleUpdated || liveProfileResult.hasPendingEdits)
      ? await fetchGoogleUpdateState(connection, liveProfileResult).catch(() => undefined)
      : undefined;

  const liveProfile = liveProfileResult;
  const description =
    liveProfile?.description || place?.description || "";
  const hasDescription = description.length > 0;
  const posts = enrichment.posts;
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.createTime ?? 0).getTime() - new Date(a.createTime ?? 0).getTime()
  );
  const postInsights =
    sortedPosts.length > 0
      ? await reportGbpLocalPostInsights(
          connection,
          sortedPosts.slice(0, 5).map((post) => post.name).filter(Boolean)
        ).catch(() => [])
      : [];
  const localPosts = analyzeGbpLocalPostCoverage({
    posts,
    insights: postInsights,
    probe: { endpoints: { list: enrichment.postsApiOk ? "ok" : "failed" } },
  });
  const questions = enrichment.questions;
  const gbpReviews = enrichment.reviews;
  const reviewCoverage = analyzeGbpReviewCoverage({
    reviews: gbpReviews,
    probe: { endpoints: { list: enrichment.reviewsApiOk ? "ok" : "failed" } },
  });
  const respondedReviews = gbpReviews.filter((r) => isReviewResponded(r));
  const responseRate =
    gbpReviews.length > 0 ? respondedReviews.length / gbpReviews.length : 0;
  const performance = enrichment.performance;

  const primaryCategory =
    liveProfile?.primaryCategory?.displayName ||
    client.industry ||
    primaryCategoryFromTypes(place?.types ?? []);
  const placeActions = analyzeGbpPlaceActionCoverage({
    links: placeActionLinks,
    availableTypes: placeActionTypes,
    primaryCategory,
  });
  const secondaryCategories = liveProfile?.additionalCategories.length
    ? liveProfile.additionalCategories.map((c) => c.displayName)
    : secondaryCategoriesFromTypes(place?.types ?? []);

  const serviceItems = liveProfile?.serviceItems ?? [];
  const attributes =
    attributeSummary.labels.length > 0
      ? attributeSummary.labels
      : (liveProfile?.attributes ?? []);
  const hasHours = liveProfile?.hasRegularHours ?? place?.hasHours ?? false;
  const hasFullWeekHours = liveProfile?.hasFullWeekHours ?? false;
  const hasHolidayHours =
    liveProfile?.hasSpecialHours ?? liveProfile?.hasMoreHours ?? place?.hasHolidayHours ?? false;
  const noPendingEdits = liveProfile ? !liveProfile.hasPendingEdits : true;
  const photoCount = enrichment.media.photoCount || place?.photoCount || 0;
  const mediaCoverage = analyzeGbpMediaCoverage(enrichment.media.items, {
    totalCount: enrichment.media.totalMediaItemCount,
  });

  const name = liveProfile?.title || place?.name || client.name;
  const address = place?.address || formatAddress(client);
  const phone = place?.phone || client.phone || "";
  const website = place?.website || client.website || "";
  const placeId = connection.placeId ?? client.gbpPlaceId ?? place?.placeId;
  const mapsUrl = place?.mapsUrl || client.gbpMapsUrl;

  const canonicalAddress = formatAddress(client);
  const napDrift =
    liveProfile && client.name
      ? compareNap(
          {
            name: client.name,
            phone: client.phone || phone,
            website: client.website || website,
            address: canonicalAddress,
          },
          {
            title: liveProfile.title,
            phone: liveProfile.phone,
            website: liveProfile.website,
            address: liveProfile.address,
          }
        )
      : [];

  const snapshotBase = {
    collectedAt: now,
    identity: {
      name,
      address,
      phone,
      website,
      primaryCategory,
      secondaryCategories,
      placeId,
      mapsUrl,
    },
    completeness: {
      hasHours,
      hasFullWeekHours,
      hasHolidayHours,
      hasDescription,
      descriptionLength: description.length,
      hasServices: serviceItems.length > 0,
      serviceCount: serviceItems.length,
      attributeCount: attributes.length,
      noPendingEdits,
      completenessScore: computeGbpCompletenessScore({
        hasHours,
        hasFullWeekHours,
        hasHolidayHours,
        hasDescription,
        descriptionLength: description.length,
        hasServices: serviceItems.length > 0,
        serviceCount: serviceItems.length,
        attributeCount: attributes.length,
        hasPhotos: photoCount > 0,
        hasWebsite: Boolean(website),
        noPendingEdits,
      }),
    },
    content: {
      photoCount,
      videoCount: enrichment.media.videoCount,
      photosByType:
        Object.keys(enrichment.media.photosByType).length > 0
          ? enrichment.media.photosByType
          : { all: place?.photoCount ?? 0 },
      lastPhotoUpload: enrichment.media.lastPhotoUpload,
      mediaPreviews: mediaPreviewsFromEnrichment(enrichment.media.items),
      mediaCoverage,
      totalMediaItemCount: enrichment.media.totalMediaItemCount,
      mediaInventory: mediaInventoryFromEnrichment(enrichment.media.items),
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
      warnings: performance.warnings,
      accessCheck: performance.accessCheck,
      coverage: performance.coverage,
    },
    issues: {
      isSuspended: place?.businessStatus === "CLOSED_PERMANENTLY",
      isVerified: place?.isOperational ?? true,
      hasDuplicateListings: false,
      napInconsistencies: napDrift.map(
        (d) => `${d.label}: onboarding "${d.canonical}" vs GBP "${d.live}"`
      ),
    },
  };

  return {
    ...snapshotBase,
    locationInventory: buildGbpLocationInventory({
      collectedAt: now,
      source: liveProfile ? "oauth" : place ? "mixed" : "oauth",
      profile: liveProfile,
      identity: snapshotBase.identity,
      completeness: snapshotBase.completeness,
      content: snapshotBase.content,
      engagement: snapshotBase.engagement,
      performance: snapshotBase.performance,
      issues: snapshotBase.issues,
      googleUpdateState,
      liveProfile: {
        primaryCategory,
        secondaryCategories,
        description,
        services: serviceItems,
        attributes,
        source: liveProfile ? "oauth" : "places",
      },
    }),
    liveProfile: {
      primaryCategory,
      secondaryCategories,
      description,
      services: serviceItems,
      attributes,
      source: liveProfile ? "oauth" : "places",
    },
    recentPosts: sortedPosts.slice(0, 5).map((p) => ({
      createTime: p.createTime ?? "",
      summary: p.summary,
      name: p.name,
      topicType: p.topicType,
      state: p.state,
      searchUrl: p.searchUrl,
      actionType: p.callToAction?.actionType
        ? localPostActionLabel(p.callToAction.actionType)
        : undefined,
    })),
    qaItems: questions.slice(0, 10).map((q) => ({
      question: q.text,
      answerCount: q.answerCount,
      topAnswer: q.topAnswer,
    })),
    googleSuggestions,
    googleUpdateState,
    hasGoogleUpdated: liveProfile?.hasGoogleUpdated ?? false,
    notifications,
    placeActions,
    placeActionLinks: placeActionLinks.map((link) => ({
      name: link.name,
      uri: link.uri,
      placeActionType: link.placeActionType,
      displayType: placeActionTypeLabel(link.placeActionType),
      isPreferred: link.isPreferred,
      isEditable: link.isEditable,
      providerType: link.providerType,
    })),
    localPosts,
    reviewCoverage,
    napDrift,
  };
}

/** Public GBP snapshot from Places API only — used for preview audits without OAuth. */
export async function collectGbpFromPlaceDetails(client: ClientConfig): Promise<GbpSnapshot> {
  const place = await fetchPlaceDetails(client.gbpPlaceId!);
  const now = new Date().toISOString();
  const description = place.description;

  const identity = {
    name: place.name || client.name,
    address: place.address,
    phone: place.phone || client.phone || "",
    website: place.website || client.website || "",
    primaryCategory: client.industry || primaryCategoryFromTypes(place.types),
    secondaryCategories: secondaryCategoriesFromTypes(place.types),
    placeId: place.placeId,
    mapsUrl: place.mapsUrl || client.gbpMapsUrl,
  };
  const completeness = {
    hasHours: place.hasHours,
    hasFullWeekHours: false,
    hasHolidayHours: place.hasHolidayHours,
    hasDescription: description.length > 0,
    descriptionLength: description.length,
    hasServices: false,
    serviceCount: 0,
    attributeCount: 0,
    noPendingEdits: true,
    completenessScore: computeGbpCompletenessScore({
      hasHours: place.hasHours,
      hasFullWeekHours: false,
      hasHolidayHours: place.hasHolidayHours,
      hasDescription: description.length > 0,
      descriptionLength: description.length,
      hasServices: false,
      serviceCount: 0,
      attributeCount: 0,
      hasPhotos: place.photoCount > 0,
      hasWebsite: Boolean(place.website),
      noPendingEdits: true,
    }),
  };
  const content = {
    photoCount: place.photoCount,
    videoCount: 0,
    photosByType: { all: place.photoCount },
    lastPhotoUpload: null,
    postCount: 0,
    lastPostDate: null,
    qaCount: 0,
    unansweredQa: 0,
  };
  const engagement = {
    reviewCount: place.reviewCount,
    averageRating: place.rating ?? 0,
    reviewsLast30Days: 0,
    reviewsLast90Days: 0,
    responseRate: 0,
    avgResponseTimeHours: 0,
  };
  const performance = {
    calls: 0,
    directionRequests: 0,
    websiteClicks: 0,
    profileViews: 0,
    impressionsMaps: 0,
    impressionsSearch: 0,
    conversations: 0,
    bookings: 0,
    periodDays: 30,
    source: "unavailable" as const,
  };
  const issues = {
    isSuspended: place.businessStatus === "CLOSED_PERMANENTLY",
    isVerified: place.isOperational,
    hasDuplicateListings: false,
    napInconsistencies: [] as string[],
  };
  const liveProfile = {
    primaryCategory: identity.primaryCategory,
    secondaryCategories: identity.secondaryCategories,
    description,
    services: [] as Array<{ name: string; description: string }>,
    attributes: [] as string[],
    source: "places" as const,
  };

  return {
    collectedAt: now,
    identity,
    completeness,
    content,
    engagement,
    performance,
    issues,
    locationInventory: buildGbpLocationInventory({
      collectedAt: now,
      source: "places",
      profile: null,
      identity,
      completeness,
      content,
      engagement,
      performance,
      issues,
      liveProfile,
    }),
    liveProfile,
    recentPosts: [],
    qaItems: [],
    googleSuggestions: [],
    hasGoogleUpdated: false,
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
