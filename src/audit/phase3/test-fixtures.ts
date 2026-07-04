import type { FullAuditPayload, Phase1AuditPayload } from "../types";
import { computeGbpCompletenessScore } from "../completeness";
import { buildTemplateGbpPlan } from "../phase2/gbp-plan";
import { buildStrategy } from "../phase2/strategy";
import { generateExecutionQueue } from "./planner";

function minimalPhase1(): Phase1AuditPayload {
  return {
    clientId: "test-client",
    clientName: "Dallas Pro Plumbing",
    auditId: "2026-07-03",
    trigger: "manual",
    period: "2026-07",
    startedAt: "2026-07-03T12:00:00.000Z",
    completedAt: "2026-07-03T12:05:00.000Z",
    gbp: {
      collectedAt: "2026-07-03T12:00:00.000Z",
      identity: {
        name: "Dallas Pro Plumbing",
        address: "123 Main St, Dallas, TX 75201",
        phone: "(214) 555-0100",
        website: "https://dallasproplumbing.example",
        primaryCategory: "Plumber",
        secondaryCategories: ["Emergency plumber"],
      },
      completeness: {
        hasHours: true,
        hasFullWeekHours: true,
        hasHolidayHours: false,
        hasDescription: true,
        descriptionLength: 120,
        hasServices: true,
        serviceCount: 2,
        attributeCount: 3,
        noPendingEdits: true,
        completenessScore: computeGbpCompletenessScore({
          hasHours: true,
          hasFullWeekHours: true,
          hasHolidayHours: false,
          hasDescription: true,
          descriptionLength: 120,
          hasServices: true,
          serviceCount: 2,
          attributeCount: 3,
          hasPhotos: true,
          hasWebsite: true,
          noPendingEdits: true,
        }),
      },
      content: {
        photoCount: 24,
        videoCount: 0,
        photosByType: {},
        lastPhotoUpload: null,
        postCount: 1,
        lastPostDate: "2026-05-01T00:00:00.000Z",
        qaCount: 2,
        unansweredQa: 1,
      },
      engagement: {
        reviewCount: 87,
        averageRating: 4.6,
        reviewsLast30Days: 4,
        reviewsLast90Days: 12,
        responseRate: 0.72,
        avgResponseTimeHours: 36,
      },
      performance: {
        calls: 42,
        directionRequests: 88,
        websiteClicks: 31,
        profileViews: 410,
        impressionsMaps: 1200,
        impressionsSearch: 800,
        conversations: 0,
        bookings: 0,
        periodDays: 30,
      },
      issues: {
        isSuspended: false,
        isVerified: true,
        hasDuplicateListings: false,
        napInconsistencies: [],
      },
      liveProfile: {
        description: "Professional plumbing services in Dallas.",
        primaryCategory: "Plumber",
        secondaryCategories: ["Emergency plumber"],
        services: [
          { name: "Drain cleaning", description: "Professional drain cleaning in Dallas." },
          { name: "Water heater repair", description: "Fast water heater repair and replacement." },
        ],
        attributes: ["Identifies as veteran-owned"],
        source: "places",
      },
      recentPosts: [],
      qaItems: [],
    },
    rankings: {
      collectedAt: "2026-07-03T12:00:00.000Z",
      keywords: [
        {
          keyword: "emergency plumber dallas",
          localPackPosition: "not_in_pack",
          inLocalPack: false,
          geoRanks: [
            { distanceMiles: 1, rank: 8, inLocalPack: false },
            { distanceMiles: 3, rank: 12, inLocalPack: false },
            { distanceMiles: 5, rank: 15, inLocalPack: false },
          ],
          packLeaderRating: 4.8,
          packLeaderReviewCount: 210,
          clientRating: 4.6,
          clientReviewCount: 87,
        },
        {
          keyword: "plumber near me",
          localPackPosition: 3,
          inLocalPack: true,
          geoRanks: [
            { distanceMiles: 1, rank: 3, inLocalPack: true },
            { distanceMiles: 3, rank: 4, inLocalPack: true },
            { distanceMiles: 5, rank: 5, inLocalPack: true },
          ],
          packLeaderRating: 4.9,
          packLeaderReviewCount: 320,
          clientRating: 4.6,
          clientReviewCount: 87,
        },
        {
          keyword: "drain cleaning dallas",
          localPackPosition: "not_in_pack",
          inLocalPack: false,
          geoRanks: [
            { distanceMiles: 1, rank: 11, inLocalPack: false },
            { distanceMiles: 3, rank: 14, inLocalPack: false },
            { distanceMiles: 5, rank: 18, inLocalPack: false },
          ],
          packLeaderRating: 4.7,
          packLeaderReviewCount: 156,
          clientRating: 4.6,
          clientReviewCount: 87,
        },
      ],
      keywordsInPack: 1,
      totalKeywords: 3,
      shareOfVoice: 33,
    },
    competitors: [],
    reviews: {
      collectedAt: "2026-07-03T12:00:00.000Z",
      reviews: [],
      sentiment: {
        positiveThemes: [],
        negativeThemes: [],
        praiseCount: 0,
        complaintCount: 0,
        neutralCount: 0,
      },
      unrespondedNegative: 2,
      disputeCandidates: [],
      velocityVsPriorMonth: 0,
      avgResponseTimeHours: 36,
      pendingReplies: 0,
      rejectedReplies: 0,
    },
    offGoogle: {
      collectedAt: "2026-07-03T12:00:00.000Z",
      citations: [],
      citationConsistencyScore: 80,
      website: {
        napMatch: true,
        hasLocalBusinessSchema: false,
        hasLocalLandingPage: true,
        issues: [],
      },
      socialPostCountLast30Days: 0,
    },
  };
}

export function createTestAudit(): FullAuditPayload {
  const phase1 = minimalPhase1();
  const strategy = buildStrategy(phase1);
  const audit: FullAuditPayload = {
    ...phase1,
    strategy: {
      ...strategy,
      gbpPlan: buildTemplateGbpPlan(phase1),
    },
  };
  const execution = generateExecutionQueue(audit);
  return { ...audit, execution };
}
