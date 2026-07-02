import type { ClientConfig, GbpSnapshot } from "../types";

function completenessScore(fields: boolean[]): number {
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

/**
 * Collects Google Business Profile snapshot.
 * Uses GBP API when GOOGLE_BUSINESS_API_KEY is set; otherwise demo data.
 */
export async function collectGbpSnapshot(client: ClientConfig): Promise<GbpSnapshot> {
  const useLiveApi = Boolean(process.env.GOOGLE_BUSINESS_API_KEY && client.gbpPlaceId);

  if (useLiveApi) {
    return collectGbpFromApi(client);
  }

  return collectGbpDemo(client);
}

async function collectGbpFromApi(client: ClientConfig): Promise<GbpSnapshot> {
  // Stub for live GBP API — wire to Google Business Profile API when credentials exist.
  const _placeId = client.gbpPlaceId;
  void _placeId;
  throw new Error(
    "Live GBP API integration pending. Set GOOGLE_BUSINESS_API_KEY and implement collectGbpFromApi."
  );
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
      lastPhotoUpload: daysAgo(21),
      postCount: 6,
      lastPostDate: daysAgo(18),
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

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
