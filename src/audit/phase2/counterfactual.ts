import type { FullAuditPayload, GapFlag, KeywordRankSnapshot, Phase1AuditPayload, ActionMarginalImpact, PathOptimizationMode, PathOptimizationBlendWeights } from "../types";
import { computeGbpCompletenessScore } from "../completeness";
import {
  inferRecommendedSecondaryCategories,
  missingKeywordsForServices,
} from "./gbp-current-state";
import { computeHealthScores } from "./scoring";
import {
  blendEngagementRates,
  calibratedRevenueGain,
  rankDeltaForGap,
  rankDeltaForStep,
  type AttributionCalibration,
  type EngagementGainRates,
  type GapAttributionCalibration,
} from "./attribution-calibration";
import {
  compositeMarginalScore,
  engagementOutcomePoints,
  marginalScoreForMode,
  resolveBlendWeights,
} from "./path-optimization";
import {
  applyKeywordPortfolioToAudit,
  computeKeywordPortfolio,
  KEYWORD_PORTFOLIO_PLAN_STEP,
  portfolioStepIsSatisfied,
} from "./keyword-portfolio";
import { CONVERSION_PLAN_STEPS } from "./conversion-constants";
import { computeKeywordScores } from "./keyword-scores";
import { detectPackFragility, resolveKeywordPositionAtRadius } from "./scoring";
import { type SearchRadiusMiles } from "@/lib/google/places";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";
import {
  primaryCategoryUpdateIsNoOp,
  resolveRecommendedPrimaryCategory,
} from "./gbp-category";
import { isReviewResponseWorkSatisfied } from "@/audit/review-engagement";
import {
  buildGbpDescriptionDraft,
  cityFromAddress,
} from "@/lib/google/gbp-description-draft";
import { buildOutcomePriorityServiceBlocks } from "@/lib/google/gbp-service-descriptions";

const CONVERSION_PLAN_STEP_SET = new Set<number>(CONVERSION_PLAN_STEPS);

/** Fractional view→action rates for conversion-family plan steps. */
export function heuristicConversionEngagementRates(
  stepNumber: number
): EngagementGainRates | null {
  switch (stepNumber) {
    case 8:
      return { calls: 0.02, directions: 0.025, websiteClicks: 0 };
    case 11:
      return { calls: 0.01, directions: 0, websiteClicks: 0 };
    case 13:
      return { calls: 0, directions: 0, websiteClicks: 0.015 };
    case 15:
      return { calls: 0.025, directions: 0.04, websiteClicks: 0.03 };
    default:
      return null;
  }
}

/** Heuristic rates blended with attribution when sample size ≥ 2. */
export function conversionEngagementRates(
  stepNumber: number,
  views: number,
  calibration?: AttributionCalibration
): EngagementGainRates | null {
  const heuristic = heuristicConversionEngagementRates(stepNumber);
  if (!heuristic) return null;
  return blendEngagementRates(heuristic, stepNumber, views, calibration);
}

function scaleConversionEngagementGains(
  views: number,
  rates: EngagementGainRates,
  scale: number
): EngagementGainRates {
  return {
    calls: Math.ceil(views * rates.calls * scale),
    directions: Math.ceil(views * rates.directions * scale),
    websiteClicks: Math.ceil(views * rates.websiteClicks * scale),
  };
}

/** Soft floor for photo mutations — satisfaction uses coverage, not this count. */
const PHOTO_COVERAGE_FLOOR = 25;
const POST_FRESH_DAYS = 14;
const RESPONSE_RATE_TARGET = 0.85;
const DESCRIPTION_MIN_LENGTH = 400;
const DEFAULT_RANK_IMPROVEMENT = 2;
const CUSTOM_PLAN_STEP_START = 18;

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function textContainsKeyword(text: string, keyword: string): boolean {
  const words = keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const lower = text.toLowerCase();
  if (words.length === 0) return lower.includes(keyword.toLowerCase());
  return words.some((w) => lower.includes(w));
}

function targetKeywords(audit: Phase1AuditPayload): string[] {
  return audit.rankings.keywords.map((k) => k.keyword);
}

function ensureLiveProfile(audit: Phase1AuditPayload): void {
  if (!audit.gbp.liveProfile) {
    audit.gbp.liveProfile = {
      description: audit.gbp.identity.primaryCategory,
      primaryCategory: audit.gbp.identity.primaryCategory,
      secondaryCategories: [...audit.gbp.identity.secondaryCategories],
      services: [],
      attributes: [],
      source: "places",
    };
  }
}

function buildOptimizedDescription(audit: Phase1AuditPayload): string {
  return buildGbpDescriptionDraft(audit);
}

function bumpCompleteness(audit: Phase1AuditPayload): void {
  const { gbp } = audit;
  gbp.completeness.completenessScore = computeGbpCompletenessScore({
    hasHours: gbp.completeness.hasHours,
    hasFullWeekHours: gbp.completeness.hasFullWeekHours,
    hasHolidayHours: gbp.completeness.hasHolidayHours,
    hasDescription: gbp.completeness.hasDescription,
    descriptionLength: gbp.completeness.descriptionLength,
    hasServices: gbp.completeness.hasServices,
    serviceCount: gbp.completeness.serviceCount,
    attributeCount: gbp.completeness.attributeCount,
    hasPhotos: gbp.content.photoCount > 0,
    hasWebsite: Boolean(gbp.identity.website),
    noPendingEdits: gbp.completeness.noPendingEdits,
  });
}

function ensurePerformanceCoverage(audit: Phase1AuditPayload) {
  const { performance } = audit.gbp;
  if (!performance.coverage) {
    performance.coverage = {
      apiAvailable: performance.source === "api",
      partialApi: false,
      coverageScore: performance.source === "api" ? 60 : 0,
      hasCoreMetrics: true,
      hasImpressionMetrics: performance.impressionsMaps > 0 || performance.impressionsSearch > 0,
      hasSearchKeywords: (performance.searchKeywords?.length ?? 0) > 0,
      hasConversations: performance.conversations > 0,
      hasBookings: performance.bookings > 0,
      keywordCount: performance.searchKeywords?.length ?? 0,
      trackedKeywordCount:
        performance.searchKeywords?.filter((kw) => kw.impressions != null && !kw.belowThreshold)
          .length ?? 0,
      totalActions: performance.calls + performance.directionRequests + performance.websiteClicks,
      actionRate: 0,
      endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "ok" },
      recommendations: [],
    };
    if (performance.profileViews > 0) {
      performance.coverage.actionRate =
        Math.round((performance.coverage.totalActions / performance.profileViews) * 1000) / 10;
    }
  }
  return performance.coverage;
}

function ensureLocalPostCoverage(audit: Phase1AuditPayload) {
  const { gbp } = audit;
  if (!gbp.localPosts) {
    const days = daysSince(gbp.content.lastPostDate);
    gbp.localPosts = {
      apiAvailable: true,
      partialApi: false,
      coverageScore: days <= 14 ? 80 : 40,
      postCount: gbp.content.postCount,
      livePostCount: gbp.content.postCount,
      rejectedPostCount: 0,
      processingPostCount: 0,
      postsLast30Days: days <= 30 ? 1 : 0,
      daysSinceLastPost: days >= 999 ? null : days,
      topicTypesUsed: ["STANDARD"],
      hasOfferPost: false,
      hasEventPost: false,
      hasCallToActionPosts: false,
      hasMediaPosts: false,
      totalViews: null,
      endpoints: { list: "ok", insights: "skipped" },
      recommendations: [],
    };
  }
  return gbp.localPosts;
}

function ensurePlaceActionCoverage(audit: Phase1AuditPayload) {
  const { gbp } = audit;
  if (!gbp.placeActions) {
    gbp.placeActions = {
      apiAvailable: true,
      partialApi: false,
      coverageScore: 0,
      linkCount: 0,
      merchantLinkCount: 0,
      configuredTypes: [],
      availableTypes: ["APPOINTMENT", "ONLINE_APPOINTMENT"],
      missingRecommendedTypes: ["APPOINTMENT", "ONLINE_APPOINTMENT"],
      missingAvailableTypes: ["APPOINTMENT", "ONLINE_APPOINTMENT"],
      typeCatalog: [
        { placeActionType: "APPOINTMENT", displayName: "Book appointment" },
        { placeActionType: "ONLINE_APPOINTMENT", displayName: "Book online appointment" },
      ],
      hasAppointmentLink: false,
      hasOnlineAppointmentLink: false,
      hasDiningReservationLink: false,
      hasFoodOrderingLink: false,
      hasShopOnlineLink: false,
      endpoints: { links: "ok", typeMetadata: "ok" },
      recommendations: [],
    };
  }
  return gbp.placeActions;
}

function ensureReviewCoverage(audit: Phase1AuditPayload) {
  const { gbp, reviews } = audit;
  const existing = reviews.coverage ?? gbp.reviewCoverage;
  const coverage = {
    apiAvailable: true,
    partialApi: false,
    coverageScore: Math.round(gbp.engagement.responseRate * 100),
    reviewCount: gbp.engagement.reviewCount,
    averageRating: gbp.engagement.averageRating,
    responseRate: gbp.engagement.responseRate,
    unrespondedCount: 0,
    unrespondedNegativeCount: reviews.unrespondedNegative,
    pendingReplies: reviews.pendingReplies,
    rejectedReplies: reviews.rejectedReplies,
    reviewsLast30Days: gbp.engagement.reviewsLast30Days,
    reviewsWithMedia: 0,
    avgResponseTimeHours: reviews.avgResponseTimeHours,
    endpoints: { list: "ok", get: "ok" },
    recommendations: [],
    ...existing,
  };
  coverage.apiAvailable = true;
  reviews.coverage = coverage;
  gbp.reviewCoverage = coverage;
  return coverage;
}

function ensureNotificationCoverage(audit: Phase1AuditPayload) {
  const { gbp } = audit;
  if (!gbp.notifications) {
    gbp.notifications = {
      configured: false,
      pubsubTopic: null,
      enabledTypes: [],
      missingRecommendedTypes: [
        "NEW_REVIEW",
        "GOOGLE_UPDATE",
        "NEW_CUSTOMER_MEDIA",
        "VOICE_OF_MERCHANT_UPDATED",
      ],
      deprecatedTypesEnabled: [],
      coverageScore: 0,
      hasReviewAlerts: false,
      hasGoogleUpdateAlerts: false,
      hasCustomerMediaAlerts: false,
      hasVoiceOfMerchantAlerts: false,
    };
  }
  return gbp.notifications;
}

function clearRelevanceCache(audit: Phase1AuditPayload): void {
  delete audit.keywordRelevance;
}

export function cloneAudit<T extends Phase1AuditPayload>(audit: T): T {
  return structuredClone(audit);
}

/** Photos are healthy when category coverage is strong — not an arbitrary count. */
export function photoCoverageIsHealthy(audit: Phase1AuditPayload): boolean {
  const coverage = audit.gbp.content.mediaCoverage;
  if (coverage) {
    const hasCoreTrust =
      coverage.hasExterior &&
      (coverage.hasAtWork || coverage.hasTeam || coverage.hasInterior);
    return (
      coverage.coverageScore >= 65 &&
      hasCoreTrust &&
      coverage.missingCategories.length <= 1
    );
  }
  return audit.gbp.content.photoCount >= PHOTO_COVERAGE_FLOOR;
}

/** One recent service video is enough; weekly volume is cadence, not a gate. */
export function videoCoverageIsHealthy(audit: Phase1AuditPayload): boolean {
  if (audit.gbp.content.mediaCoverage?.hasVideo) return true;
  return audit.gbp.content.videoCount >= 1;
}

/** Whether a GBP plan step area is already in good shape for this business. */
export function isStepSatisfied(audit: Phase1AuditPayload, stepNumber: number): boolean {
  const { gbp, reviews } = audit;
  const keywords = targetKeywords(audit);

  switch (stepNumber) {
    case 1:
      // Primary-category work is only needed when live differs from recommended.
      // Keyword categoryFit gaps are handled via secondary categories (step 2), not a
      // no-op "update" to the same primary label.
      return primaryCategoryUpdateIsNoOp(audit);
    case 2: {
      const recommended = inferRecommendedSecondaryCategories(audit);
      // Nothing actionable to add (and never recommend the primary as secondary).
      if (recommended.length === 0) return true;

      const secondary =
        gbp.liveProfile?.secondaryCategories ?? gbp.identity.secondaryCategories;
      const existing = new Set(secondary.map((c) => c.toLowerCase()));
      return recommended.every((c) => existing.has(c.toLowerCase()));
    }
    case 3: {
      const desc = gbp.liveProfile?.description ?? "";
      return (
        desc.length >= DESCRIPTION_MIN_LENGTH &&
        keywords.every((kw) => textContainsKeyword(desc, kw))
      );
    }
    case 4:
      return missingKeywordsForServices(audit).length === 0;
    case 5:
      return audit.rankings.keywords.every((k) => k.inLocalPack);
    case 6:
      return photoCoverageIsHealthy(audit);
    case 7:
      return videoCoverageIsHealthy(audit);
    case 8:
      return daysSince(gbp.content.lastPostDate) <= POST_FRESH_DAYS;
    case 9:
      return audit.reviews.disputeCandidates.length === 0;
    case 10: {
      const hasReviewGap = audit.rankings.keywords.some(
        (k) => k.inLocalPack && k.clientReviewCount < k.packLeaderReviewCount * 0.5
      );
      const reviewTarget = Math.max(200, gbp.engagement.reviewCount + 50);
      return !hasReviewGap && gbp.engagement.reviewCount >= reviewTarget * 0.8;
    }
    case 11:
      return isReviewResponseWorkSatisfied(audit);
    case 12:
      return (
        gbp.completeness.hasHours &&
        gbp.completeness.hasFullWeekHours &&
        gbp.completeness.hasHolidayHours
      );
    case 13: {
      const coverage = gbp.attributeCoverage;
      if (coverage && coverage.availableCount > 0) {
        return coverage.missingCount === 0;
      }
      return gbp.completeness.attributeCount >= 5;
    }
    case 14: {
      const notifications = gbp.notifications;
      if (!notifications) return true;
      return (
        notifications.configured && notifications.missingRecommendedTypes.length === 0
      );
    }
    case 15: {
      const placeActions = gbp.placeActions;
      if (!placeActions?.apiAvailable) return true;
      return (
        placeActions.configuredTypes.length > 0 &&
        placeActions.missingAvailableTypes.length === 0
      );
    }
    case KEYWORD_PORTFOLIO_PLAN_STEP:
      return portfolioStepIsSatisfied(audit);
    default:
      return false;
  }
}

/** Apply the audit-input changes that completing this plan step would represent. */
export function applyStepMutation(audit: Phase1AuditPayload, stepNumber: number): void {
  clearRelevanceCache(audit);
  const keywords = targetKeywords(audit);

  switch (stepNumber) {
    case 1: {
      // Primary category only — secondaries belong to step 2.
      ensureLiveProfile(audit);
      const recommended = resolveRecommendedPrimaryCategory(audit);
      if (recommended) {
        audit.gbp.liveProfile!.primaryCategory = recommended;
        audit.gbp.identity.primaryCategory = recommended;
      }
      bumpCompleteness(audit);
      break;
    }
    case 2: {
      ensureLiveProfile(audit);
      const recommended = inferRecommendedSecondaryCategories(audit);
      const existing = new Set(
        audit.gbp.liveProfile!.secondaryCategories.map((c) => c.toLowerCase())
      );
      for (const category of recommended) {
        if (!existing.has(category.toLowerCase())) {
          audit.gbp.liveProfile!.secondaryCategories.push(category);
          existing.add(category.toLowerCase());
        }
      }
      bumpCompleteness(audit);
      break;
    }
    case 3: {
      ensureLiveProfile(audit);
      audit.gbp.liveProfile!.description = buildOptimizedDescription(audit);
      audit.gbp.completeness.descriptionLength = audit.gbp.liveProfile!.description.length;
      audit.gbp.completeness.hasDescription = true;
      bumpCompleteness(audit);
      break;
    }
    case 4: {
      ensureLiveProfile(audit);
      const missing = missingKeywordsForServices(audit);
      const toAdd = missing.length > 0 ? missing : keywords;
      const city = cityFromAddress(audit.gbp.identity.address);
      for (const kw of toAdd) {
        audit.gbp.liveProfile!.services.push({
          name: kw,
          description: `Professional ${kw} in ${city}.`,
        });
      }
      audit.gbp.completeness.serviceCount = audit.gbp.liveProfile!.services.length;
      audit.gbp.completeness.hasServices = true;
      bumpCompleteness(audit);
      break;
    }
    case 5: {
      // Priority keyword services — mutate the same blocks the plan publishes.
      ensureLiveProfile(audit);
      const blocks = buildOutcomePriorityServiceBlocks(audit);
      const existing = new Set(
        audit.gbp.liveProfile!.services.map((service) => service.name.toLowerCase())
      );
      for (const block of blocks) {
        if (existing.has(block.serviceName.toLowerCase())) continue;
        audit.gbp.liveProfile!.services.push({
          name: block.serviceName,
          description: block.content,
        });
        existing.add(block.serviceName.toLowerCase());
      }
      audit.gbp.completeness.serviceCount = audit.gbp.liveProfile!.services.length;
      audit.gbp.completeness.hasServices = true;
      bumpCompleteness(audit);
      break;
    }
    case 6: {
      audit.gbp.content.photoCount = Math.max(
        PHOTO_COVERAGE_FLOOR,
        audit.gbp.content.photoCount
      );
      const media = audit.gbp.content.mediaCoverage;
      if (media) {
        media.hasExterior = true;
        media.hasInterior = true;
        media.hasAtWork = true;
        media.hasTeam = true;
        media.missingCategories = [];
        media.coverageScore = Math.max(media.coverageScore, 80);
      }
      bumpCompleteness(audit);
      break;
    }
    case 7:
      audit.gbp.content.videoCount = Math.max(1, audit.gbp.content.videoCount);
      if (audit.gbp.content.mediaCoverage) {
        audit.gbp.content.mediaCoverage.hasVideo = true;
      }
      break;
    case 8: {
      audit.gbp.content.lastPostDate = new Date().toISOString();
      audit.gbp.content.postCount = Math.max(1, audit.gbp.content.postCount);
      const localPosts = ensureLocalPostCoverage(audit);
      localPosts.hasCallToActionPosts = true;
      localPosts.daysSinceLastPost = 0;
      localPosts.postsLast30Days = Math.max(1, localPosts.postsLast30Days);
      localPosts.coverageScore = Math.max(localPosts.coverageScore, 80);
      break;
    }
    case 14: {
      const coverage = ensureNotificationCoverage(audit);
      coverage.configured = true;
      coverage.enabledTypes = [
        ...new Set([...coverage.enabledTypes, ...coverage.missingRecommendedTypes]),
      ];
      coverage.missingRecommendedTypes = [];
      coverage.coverageScore = 100;
      coverage.hasReviewAlerts = true;
      coverage.hasGoogleUpdateAlerts = true;
      coverage.hasCustomerMediaAlerts = true;
      coverage.hasVoiceOfMerchantAlerts = true;
      break;
    }
    case 15: {
      const coverage = ensurePlaceActionCoverage(audit);
      coverage.apiAvailable = true;
      coverage.configuredTypes = ["APPOINTMENT", "ONLINE_APPOINTMENT"];
      coverage.missingRecommendedTypes = [];
      coverage.missingAvailableTypes = [];
      coverage.coverageScore = 100;
      coverage.hasAppointmentLink = true;
      coverage.hasOnlineAppointmentLink = true;
      coverage.linkCount = Math.max(2, coverage.linkCount);
      coverage.merchantLinkCount = Math.max(2, coverage.merchantLinkCount);
      break;
    }
    case 9: {
      const toRemove = new Set(audit.reviews.disputeCandidates);
      audit.reviews.reviews = audit.reviews.reviews.filter((r) => !toRemove.has(r.id));
      audit.reviews.disputeCandidates = [];
      const remaining = audit.reviews.reviews;
      if (remaining.length > 0) {
        const totalRating = remaining.reduce((sum, r) => sum + r.rating, 0);
        audit.gbp.engagement.reviewCount = remaining.length;
        audit.gbp.engagement.averageRating =
          Math.round((totalRating / remaining.length) * 10) / 10;
      }
      audit.reviews.unrespondedNegative = remaining.filter(
        (r) => r.rating <= 3 && !r.responded
      ).length;
      break;
    }
    case 10: {
      const avgLeader =
        audit.rankings.keywords.reduce((s, k) => s + k.packLeaderReviewCount, 0) /
        Math.max(audit.rankings.keywords.length, 1);
      const reviewTarget = Math.max(200, audit.gbp.engagement.reviewCount + 50, avgLeader * 0.8);
      audit.gbp.engagement.reviewCount = Math.round(
        Math.max(audit.gbp.engagement.reviewCount, reviewTarget)
      );
      break;
    }
    case 11:
      audit.reviews.unrespondedNegative = 0;
      audit.gbp.engagement.responseRate = 1;
      break;
    case 12:
      audit.gbp.completeness.hasHolidayHours = true;
      audit.gbp.completeness.hasHours = true;
      audit.gbp.completeness.hasFullWeekHours = true;
      bumpCompleteness(audit);
      break;
    case 13: {
      const coverage = audit.gbp.attributeCoverage;
      ensureLiveProfile(audit);
      if (coverage) {
        audit.gbp.completeness.attributeCount = Math.max(
          coverage.enabledCount + coverage.autoUpdates.length,
          audit.gbp.completeness.attributeCount
        );
        const labels = new Set(audit.gbp.liveProfile!.attributes);
        for (const item of coverage.enabled) {
          labels.add(item.displayName);
        }
        for (const item of coverage.missing.filter((entry) => entry.autoApplicable)) {
          labels.add(item.displayName);
        }
        audit.gbp.liveProfile!.attributes = [...labels];
      } else {
        audit.gbp.completeness.attributeCount = Math.max(5, audit.gbp.completeness.attributeCount);
        if (audit.gbp.liveProfile!.attributes.length < 5) {
          audit.gbp.liveProfile!.attributes.push(
            "Online appointments",
            "Wheelchair accessible",
            "Accepts credit cards"
          );
        }
      }
      bumpCompleteness(audit);
      break;
    }
    case KEYWORD_PORTFOLIO_PLAN_STEP:
      applyKeywordPortfolioToAudit(audit);
      break;
    default:
      break;
  }
}

/** Apply audit-input changes that closing this gap would represent. */
export function applyGapMutation(audit: Phase1AuditPayload, gap: GapFlag): void {
  if (gap.id.startsWith("rank-outside-pack")) return;

  if (
    gap.id === "keyword-portfolio-mismatch" ||
    gap.id === "untracked-gbp-keywords"
  ) {
    applyKeywordPortfolioToAudit(audit);
    return;
  }

  if (gap.id.startsWith("rank-without-demand-")) {
    const keyword = gap.id.replace("rank-without-demand-", "");
    applyKeywordPortfolioToAudit(audit, { swapOutKeyword: keyword });
    return;
  }

  if (gap.id.startsWith("relevance-gap-")) {
    const keyword = gap.id.replace("relevance-gap-", "");
    ensureLiveProfile(audit);
    const desc = audit.gbp.liveProfile!.description ?? "";
    if (!textContainsKeyword(desc, keyword)) {
      audit.gbp.liveProfile!.description = `${desc} We specialize in ${keyword}.`.trim();
      audit.gbp.completeness.descriptionLength = audit.gbp.liveProfile!.description.length;
    }
    const services = audit.gbp.liveProfile!.services ?? [];
    if (!services.some((s) => textContainsKeyword(s.name, keyword))) {
      audit.gbp.liveProfile!.services.push({
        name: keyword,
        description: `Professional ${keyword} services.`,
      });
    }
    clearRelevanceCache(audit);
    return;
  }

  if (gap.id.startsWith("review-gap-")) {
    const kw = audit.rankings.keywords.find((k) => gap.id === `review-gap-${k.keyword}`);
    if (kw) {
      audit.gbp.engagement.reviewCount = Math.max(
        audit.gbp.engagement.reviewCount,
        Math.round(kw.packLeaderReviewCount * 0.55)
      );
    }
    return;
  }

  switch (gap.id) {
    case "stale-posts":
      audit.gbp.content.lastPostDate = new Date().toISOString();
      break;
    case "low-photos":
      audit.gbp.content.photoCount = Math.max(
        PHOTO_COVERAGE_FLOOR,
        audit.gbp.content.photoCount
      );
      if (audit.gbp.content.mediaCoverage) {
        audit.gbp.content.mediaCoverage.coverageScore = Math.max(
          audit.gbp.content.mediaCoverage.coverageScore,
          70
        );
        audit.gbp.content.mediaCoverage.hasExterior = true;
        audit.gbp.content.mediaCoverage.hasAtWork = true;
        audit.gbp.content.mediaCoverage.missingCategories = [];
      }
      break;
    case "missing-holiday-hours":
      audit.gbp.completeness.hasHolidayHours = true;
      bumpCompleteness(audit);
      break;
    case "missing-hours":
      audit.gbp.completeness.hasHours = true;
      audit.gbp.completeness.hasFullWeekHours = true;
      bumpCompleteness(audit);
      break;
    case "incomplete-week-hours":
      audit.gbp.completeness.hasFullWeekHours = true;
      bumpCompleteness(audit);
      break;
    case "low-attributes":
      audit.gbp.completeness.attributeCount = Math.max(5, audit.gbp.completeness.attributeCount);
      bumpCompleteness(audit);
      break;
    case "google-pending-edits":
    case "google-suggested-edits":
      audit.gbp.completeness.noPendingEdits = true;
      audit.gbp.googleSuggestions = [];
      bumpCompleteness(audit);
      break;
    case "nap-drift-title":
    case "nap-drift-phone":
    case "nap-drift-website":
    case "nap-drift-address":
      audit.gbp.napDrift = [];
      audit.gbp.issues.napInconsistencies = [];
      break;
    case "unresponded-negative":
      audit.reviews.unrespondedNegative = 0;
      break;
    case "dispute-candidates":
      applyStepMutation(audit, 9);
      break;
    case "low-response-rate":
      audit.gbp.engagement.responseRate = 1;
      break;
    case "performance-api-unavailable": {
      const perf = audit.gbp.performance;
      perf.source = "api";
      delete perf.error;
      const coverage = ensurePerformanceCoverage(audit);
      coverage.apiAvailable = true;
      coverage.partialApi = false;
      coverage.coverageScore = 100;
      coverage.hasCoreMetrics = true;
      coverage.hasImpressionMetrics = true;
      coverage.hasSearchKeywords = true;
      break;
    }
    case "partial-performance-api": {
      const coverage = ensurePerformanceCoverage(audit);
      coverage.partialApi = false;
      coverage.coverageScore = 100;
      coverage.hasCoreMetrics = true;
      coverage.hasImpressionMetrics = true;
      coverage.hasSearchKeywords = true;
      audit.gbp.performance.warnings = [];
      break;
    }
    case "no-search-keyword-data": {
      const perf = audit.gbp.performance;
      perf.searchKeywords = audit.rankings.keywords.map((kw) => ({
        keyword: kw.keyword,
        impressions: 500,
        belowThreshold: false,
      }));
      const coverage = ensurePerformanceCoverage(audit);
      coverage.hasSearchKeywords = true;
      coverage.keywordCount = perf.searchKeywords.length;
      coverage.trackedKeywordCount = perf.searchKeywords.length;
      coverage.coverageScore = Math.max(coverage.coverageScore, 85);
      break;
    }
    case "low-profile-conversions":
    case "weak-profile-conversions": {
      const perf = audit.gbp.performance;
      perf.calls = Math.max(perf.calls, 20);
      perf.directionRequests = Math.max(perf.directionRequests, 30);
      perf.websiteClicks = Math.max(perf.websiteClicks, 15);
      const coverage = ensurePerformanceCoverage(audit);
      coverage.totalActions = perf.calls + perf.directionRequests + perf.websiteClicks;
      coverage.actionRate =
        perf.profileViews > 0
          ? Math.round((coverage.totalActions / perf.profileViews) * 1000) / 10
          : 10;
      break;
    }
    case "place-actions-api-unavailable": {
      const coverage = ensurePlaceActionCoverage(audit);
      coverage.apiAvailable = true;
      coverage.partialApi = false;
      coverage.endpoints = { links: "ok", typeMetadata: "ok" };
      if (coverage.configuredTypes.length === 0) {
        coverage.coverageScore = Math.max(coverage.coverageScore, 50);
      }
      break;
    }
    case "missing-place-action-links": {
      const coverage = ensurePlaceActionCoverage(audit);
      coverage.apiAvailable = true;
      coverage.configuredTypes = ["APPOINTMENT", "ONLINE_APPOINTMENT"];
      coverage.missingRecommendedTypes = [];
      coverage.missingAvailableTypes = [];
      coverage.coverageScore = 100;
      coverage.hasAppointmentLink = true;
      coverage.hasOnlineAppointmentLink = true;
      coverage.linkCount = 2;
      coverage.merchantLinkCount = 2;
      break;
    }
    case "incomplete-place-action-links": {
      const coverage = ensurePlaceActionCoverage(audit);
      coverage.missingRecommendedTypes = [];
      coverage.missingAvailableTypes = [];
      coverage.configuredTypes = [
        ...new Set([...coverage.configuredTypes, ...coverage.availableTypes.slice(0, 2)]),
      ];
      coverage.coverageScore = 100;
      coverage.hasAppointmentLink = true;
      coverage.hasOnlineAppointmentLink = true;
      break;
    }
    case "local-posts-api-unavailable": {
      const coverage = ensureLocalPostCoverage(audit);
      coverage.apiAvailable = true;
      coverage.partialApi = false;
      coverage.endpoints = { list: "ok", insights: "ok" };
      coverage.coverageScore = Math.max(
        coverage.coverageScore,
        coverage.daysSinceLastPost != null && coverage.daysSinceLastPost <= 30 ? 70 : 50
      );
      break;
    }
    case "rejected-local-posts": {
      const coverage = ensureLocalPostCoverage(audit);
      coverage.rejectedPostCount = 0;
      coverage.coverageScore = Math.max(coverage.coverageScore, 80);
      audit.gbp.content.lastPostDate = new Date().toISOString();
      coverage.daysSinceLastPost = 0;
      coverage.postsLast30Days = Math.max(coverage.postsLast30Days, 1);
      break;
    }
    case "posts-without-cta": {
      const coverage = ensureLocalPostCoverage(audit);
      coverage.hasCallToActionPosts = true;
      coverage.coverageScore = Math.max(coverage.coverageScore, 75);
      break;
    }
    case "reviews-api-unavailable": {
      const coverage = ensureReviewCoverage(audit);
      coverage.apiAvailable = true;
      coverage.partialApi = false;
      coverage.coverageScore = Math.max(coverage.coverageScore, 80);
      break;
    }
    case "rejected-review-replies": {
      audit.reviews.rejectedReplies = 0;
      const coverage = ensureReviewCoverage(audit);
      coverage.rejectedReplies = 0;
      coverage.coverageScore = Math.max(coverage.coverageScore, 85);
      break;
    }
    case "pending-review-replies": {
      audit.reviews.pendingReplies = 0;
      const coverage = ensureReviewCoverage(audit);
      coverage.pendingReplies = 0;
      coverage.coverageScore = Math.max(coverage.coverageScore, 80);
      break;
    }
    case "missing-pubsub-notifications": {
      const coverage = ensureNotificationCoverage(audit);
      coverage.configured = true;
      coverage.pubsubTopic = "projects/example/topics/gbp-notifications";
      coverage.enabledTypes = [
        "NEW_REVIEW",
        "GOOGLE_UPDATE",
        "NEW_CUSTOMER_MEDIA",
        "VOICE_OF_MERCHANT_UPDATED",
      ];
      coverage.missingRecommendedTypes = [];
      coverage.coverageScore = 100;
      coverage.hasReviewAlerts = true;
      coverage.hasGoogleUpdateAlerts = true;
      coverage.hasCustomerMediaAlerts = true;
      coverage.hasVoiceOfMerchantAlerts = true;
      break;
    }
    case "incomplete-notification-types": {
      const coverage = ensureNotificationCoverage(audit);
      coverage.enabledTypes = [
        ...new Set([...coverage.enabledTypes, ...coverage.missingRecommendedTypes]),
      ];
      coverage.missingRecommendedTypes = [];
      coverage.coverageScore = 100;
      coverage.hasReviewAlerts = true;
      coverage.hasGoogleUpdateAlerts = true;
      coverage.hasCustomerMediaAlerts = true;
      coverage.hasVoiceOfMerchantAlerts = true;
      break;
    }
    default:
      break;
  }
}

/** Marginal driver-score gain from completing one plan step, via computeHealthScores(). */
export function simulateStepDriverImpact(
  audit: Phase1AuditPayload,
  stepNumber: number
): number {
  if (isStepSatisfied(audit, stepNumber)) return 0;

  const before = computeHealthScores(audit).driverScore;
  const mutated = cloneAudit(audit);
  applyStepMutation(mutated, stepNumber);
  const after = computeHealthScores(mutated).driverScore;
  return Math.max(0, after - before);
}

function isPortfolioAlignmentGap(gap: GapFlag): boolean {
  return (
    gap.id === "keyword-portfolio-mismatch" ||
    gap.id === "untracked-gbp-keywords" ||
    gap.id.startsWith("rank-without-demand-")
  );
}

/** Marginal driver-score gain from closing one gap, via computeHealthScores(). */
export function simulateGapDriverImpact(audit: Phase1AuditPayload, gap: GapFlag): number {
  if (gap.id.startsWith("rank-outside-pack")) return 0;

  const before = computeHealthScores(audit);
  const mutated = cloneAudit(audit);
  applyGapMutation(mutated, gap);
  const after = computeHealthScores(mutated);

  if (isPortfolioAlignmentGap(gap)) {
    return Math.max(0, after.visibility - before.visibility);
  }

  return Math.max(0, after.driverScore - before.driverScore);
}

export interface ProjectedHealthScores {
  projectedDriverScore: number;
  projectedOverallScore: number;
  driverGain: number;
  overallGain: number;
}

export interface ProjectedOutcomeScores {
  projectedOutcomeIndex: number;
  projectedVisibility: number;
  projectedRevenueCapture: number;
  projectedOverallScore: number;
  outcomeGain: number;
  visibilityGain: number;
  revenueCaptureGain: number;
  overallGain: number;
  estimatedMonthlyRevenue: number | null;
  revenueGain: number | null;
  /** Projected monthly leads after actions (no ACV required). */
  estimatedMonthlyLeads: number | null;
  /** Incremental monthly leads from the action set. */
  leadsGain: number | null;
  /** Incremental monthly profile actions from conversion-family steps. */
  engagementActionsGain: number | null;
}

export interface CounterfactualProjectionOptions {
  calibration?: AttributionCalibration;
  gapCalibration?: GapAttributionCalibration;
  avgCustomerValue?: number | null;
  blendWeights?: PathOptimizationBlendWeights;
}

export interface ActionRef {
  source: "plan" | "gap";
  id: string;
}

function numericRankAtOneMile(kw: KeywordRankSnapshot): number {
  const rank1mi = kw.geoRanks.find((g) => g.distanceMiles === 1)?.rank;
  if (rank1mi != null) return rank1mi;
  if (typeof kw.localPackPosition === "number") return kw.localPackPosition;
  return 20;
}

function syncKeywordPackFields(kw: KeywordRankSnapshot): KeywordRankSnapshot {
  const rank1mi =
    kw.geoRanks.find((g) => g.distanceMiles === 1)?.rank ?? numericRankAtOneMile(kw);
  const inLocalPack = rank1mi <= 3;
  return {
    ...kw,
    inLocalPack,
    localPackPosition: inLocalPack ? (rank1mi as 1 | 2 | 3) : ("not_in_pack" as const),
  };
}

/** Keywords that need ranking-outcome work: outside 1mi pack or pack-fragile at wider radii. */
export function keywordNeedsOutcomeWork(kw: KeywordRankSnapshot): boolean {
  if (!kw.inLocalPack) return true;
  return detectPackFragility(kw).fragile;
}

function improveKeywordRankAtRadius(
  kw: KeywordRankSnapshot,
  miles: SearchRadiusMiles,
  rankDelta: number
): KeywordRankSnapshot {
  const improvedGeoRanks = kw.geoRanks.map((g) => {
    if (g.distanceMiles !== miles) return g;
    const current = g.rank ?? 20;
    const improved = Math.max(1, current - rankDelta);
    return { ...g, rank: improved, inLocalPack: improved <= 3 };
  });

  return syncKeywordPackFields({
    ...kw,
    geoRanks:
      improvedGeoRanks.length > 0
        ? improvedGeoRanks
        : [{ distanceMiles: miles, rank: Math.max(1, numericRankAtOneMile(kw) - rankDelta), inLocalPack: true }],
  });
}

function improveKeywordRank(kw: KeywordRankSnapshot, rankDelta: number): KeywordRankSnapshot {
  const improvedGeoRanks = kw.geoRanks.map((g) => {
    const current = g.rank ?? 20;
    const improved = Math.max(1, current - rankDelta);
    const inLocalPack = improved <= 3;
    return { ...g, rank: improved, inLocalPack };
  });

  const improved1mi =
    improvedGeoRanks.find((g) => g.distanceMiles === 1)?.rank ??
    Math.max(1, numericRankAtOneMile(kw) - rankDelta);
  const inLocalPack = improved1mi <= 3;
  const localPackPosition = inLocalPack
    ? (improved1mi as 1 | 2 | 3)
    : ("not_in_pack" as const);

  return syncKeywordPackFields({
    ...kw,
    inLocalPack,
    localPackPosition,
    geoRanks:
      improvedGeoRanks.length > 0
        ? improvedGeoRanks
        : [{ distanceMiles: 1, rank: improved1mi, inLocalPack }],
  });
}

/** Simulate rank #1 at every search radius (full service-area dominance). */
export function projectKeywordToRank1(kw: KeywordRankSnapshot): KeywordRankSnapshot {
  let result = kw;
  for (const miles of RADIAL_RING_MILES) {
    const rank = resolveKeywordPositionAtRadius(result, miles);
    if (typeof rank === "number" && rank > 1) {
      result = improveKeywordRankAtRadius(result, miles, rank - 1);
    }
  }
  return syncKeywordPackFields({
    ...result,
    inLocalPack: true,
    localPackPosition: 1,
    geoRanks: result.geoRanks.map((g) => ({
      ...g,
      rank: 1,
      inLocalPack: true,
    })),
  });
}

/** Bring failing radii into the pack starting at the weakest service-area point. */
export function improveKeywordRankForFragility(kw: KeywordRankSnapshot): KeywordRankSnapshot {
  const fragility = detectPackFragility(kw);
  if (!fragility.fragile || fragility.weakestRadiusMiles == null) {
    return improveKeywordRank(kw, DEFAULT_RANK_IMPROVEMENT);
  }

  let result = kw;
  for (const miles of RADIAL_RING_MILES) {
    if (miles < fragility.weakestRadiusMiles) continue;
    const rank = resolveKeywordPositionAtRadius(result, miles);
    if (typeof rank === "number" && rank > 3) {
      result = improveKeywordRankAtRadius(result, miles, rank - 3);
    }
  }
  return syncKeywordPackFields(result);
}

function refreshRankingAggregates(audit: Phase1AuditPayload): void {
  audit.rankings.keywordsInPack = audit.rankings.keywords.filter((k) => k.inLocalPack).length;
  audit.rankings.shareOfVoice = audit.rankings.keywords.length
    ? Math.round((audit.rankings.keywordsInPack / audit.rankings.keywords.length) * 100)
    : 0;
}

/** Keywords a plan step is modeled to influence for rank/outcome projections. */
export function keywordsTargetedByStep(audit: Phase1AuditPayload, stepNumber: number): string[] {
  const keywords = audit.rankings.keywords;
  const needsWork = keywords
    .filter((k) => keywordNeedsOutcomeWork(k))
    .map((k) => k.keyword);
  const outsidePack = keywords.filter((k) => !k.inLocalPack).map((k) => k.keyword);

  switch (stepNumber) {
    case 3:
    case 4:
    case 8:
      return needsWork.length > 0 ? needsWork : keywords.map((k) => k.keyword);
    case 5:
      return outsidePack;
    case 9:
    case 10:
    case 11:
      return keywords
        .filter(
          (k) =>
            keywordNeedsOutcomeWork(k) ||
            (k.inLocalPack && typeof k.localPackPosition === "number" && k.localPackPosition === 3)
        )
        .map((k) => k.keyword);
    case 6:
    case 7:
      return needsWork.slice(0, 2);
    default:
      return needsWork.slice(0, 1);
  }
}

function totalEstimatedRevenue(
  audit: Phase1AuditPayload,
  avgCustomerValue?: number | null
): number | null {
  if (!avgCustomerValue || avgCustomerValue <= 0) return null;

  const cards = computeKeywordScores(audit, { avgCustomerValue });
  let sum = 0;
  let any = false;
  for (const card of cards) {
    if (card.estimatedMonthlyRevenue != null) {
      sum += card.estimatedMonthlyRevenue;
      any = true;
    }
  }
  return any ? sum : null;
}

/** Round lead counts for display/ranking without wiping small conversion gains. */
export function roundLeadCount(leads: number): number | null {
  if (leads <= 0) return null;
  const rounded = Math.round(leads * 10) / 10;
  return rounded > 0 ? rounded : null;
}

function totalEstimatedLeads(audit: Phase1AuditPayload): number | null {
  const cards = computeKeywordScores(audit);
  let sum = 0;
  let any = false;
  for (const card of cards) {
    if (card.estimatedMonthlyLeads != null) {
      sum += card.estimatedMonthlyLeads;
      any = true;
    }
  }
  return any ? sum : null;
}

/** Sum of per-keyword monthly revenue estimates at current ranks. */
export function estimateTotalMonthlyRevenue(
  audit: Phase1AuditPayload,
  avgCustomerValue?: number | null
): number | null {
  return totalEstimatedRevenue(audit, avgCustomerValue);
}

/** Sum of per-keyword monthly lead estimates at current ranks (no ACV). */
export function estimateTotalMonthlyLeads(audit: Phase1AuditPayload): number | null {
  const total = totalEstimatedLeads(audit);
  return total == null ? null : roundLeadCount(total);
}

/**
 * Project incremental calls/directions/website clicks from conversion-oriented
 * plan steps. Used so views→actions work competes with rank work on revenue.
 * Later stacked actions are dampened like rank mutations.
 */
export function applyConversionEngagementMutation(
  audit: Phase1AuditPayload,
  stepNumber: number,
  stackIndex = 0,
  calibration?: AttributionCalibration
): void {
  const perf = audit.gbp.performance;
  const views = Math.max(perf.profileViews, 100);
  const rates = conversionEngagementRates(stepNumber, views, calibration);
  if (!rates) return;

  const gains = scaleConversionEngagementGains(
    views,
    rates,
    stackDampeningFactor(stackIndex)
  );

  perf.calls += gains.calls;
  perf.directionRequests += gains.directions;
  perf.websiteClicks += gains.websiteClicks;

  const coverage = ensurePerformanceCoverage(audit);
  coverage.totalActions = perf.calls + perf.directionRequests + perf.websiteClicks;
  if (perf.profileViews > 0) {
    coverage.actionRate =
      Math.round((coverage.totalActions / perf.profileViews) * 1000) / 10;
  }
  coverage.hasCoreMetrics = true;
}

/** Apply projected rank improvements for keywords a plan step would influence. */
export function applyOutcomeMutation(
  audit: Phase1AuditPayload,
  stepNumber: number,
  calibration?: AttributionCalibration,
  stackIndex = 0
): void {
  if (stepNumber === KEYWORD_PORTFOLIO_PLAN_STEP) {
    if (portfolioStepIsSatisfied(audit)) return;
    const portfolio = audit.keywordPortfolio ?? computeKeywordPortfolio(audit);
    const swapIns = new Set(
      portfolio.recommendedSwaps.map((swap) => swap.swapIn.toLowerCase())
    );
    const dampened = Math.max(1, Math.round(2 * stackDampeningFactor(stackIndex)));
    audit.rankings.keywords = audit.rankings.keywords.map((kw) =>
      swapIns.has(kw.keyword.toLowerCase()) ? improveKeywordRank(kw, dampened) : kw
    );
    refreshRankingAggregates(audit);
    return;
  }

  if (stepNumber >= CUSTOM_PLAN_STEP_START) return;
  if (isStepSatisfied(audit, stepNumber)) return;

  applyConversionEngagementMutation(audit, stepNumber, stackIndex, calibration);

  // Conversion-family + alerts: engagement channel only — no pack-rank revenue claim.
  if (CONVERSION_PLAN_STEP_SET.has(stepNumber) || stepNumber === 14) return;

  const baseDelta = rankDeltaForStep(stepNumber, calibration);
  if (baseDelta <= 0) return;

  const rankDelta = Math.max(1, Math.round(baseDelta * stackDampeningFactor(stackIndex)));
  const targets = new Set(
    keywordsTargetedByStep(audit, stepNumber).map((keyword) => keyword.toLowerCase())
  );
  if (targets.size === 0) return;

  audit.rankings.keywords = audit.rankings.keywords.map((kw) =>
    targets.has(kw.keyword.toLowerCase()) ? improveKeywordRank(kw, rankDelta) : kw
  );
  refreshRankingAggregates(audit);
}

/** Apply projected rank improvements for rank-outside-pack and pack-fragility gaps. */
export function applyOutcomeGapMutation(
  audit: Phase1AuditPayload,
  gap: GapFlag,
  options?: CounterfactualProjectionOptions
): void {
  if (
    gap.id === "keyword-portfolio-mismatch" ||
    gap.id === "untracked-gbp-keywords" ||
    gap.id.startsWith("rank-without-demand-")
  ) {
    const portfolio = audit.keywordPortfolio ?? computeKeywordPortfolio(audit);
    const swapIns = new Set(
      portfolio.recommendedSwaps.map((swap) => swap.swapIn.toLowerCase())
    );
    audit.rankings.keywords = audit.rankings.keywords.map((kw) =>
      swapIns.has(kw.keyword.toLowerCase()) ? improveKeywordRank(kw, 2) : kw
    );
    refreshRankingAggregates(audit);
    return;
  }

  if (gap.id.startsWith("pack-fragility-")) {
    const keyword = gap.id.replace("pack-fragility-", "");
    audit.rankings.keywords = audit.rankings.keywords.map((kw) => {
      if (kw.keyword.toLowerCase() !== keyword.toLowerCase()) return kw;
      return improveKeywordRankForFragility(kw);
    });
    refreshRankingAggregates(audit);
    return;
  }

  if (!gap.id.startsWith("rank-outside-pack-")) return;

  const keyword = gap.id.replace("rank-outside-pack-", "");
  audit.rankings.keywords = audit.rankings.keywords.map((kw) => {
    if (kw.keyword.toLowerCase() !== keyword.toLowerCase()) return kw;
    const delta = rankDeltaForGap(
      gap.id,
      numericRankAtOneMile(kw),
      options?.gapCalibration
    );
    return improveKeywordRank(kw, delta);
  });
  refreshRankingAggregates(audit);
}

function applyActionMutations(
  audit: Phase1AuditPayload,
  action: ActionRef,
  options?: CounterfactualProjectionOptions,
  stackIndex = 0
): void {
  if (action.source === "plan") {
    const match = action.id.match(/^gbp-step-(\d+)$/);
    if (!match) return;
    const stepNumber = Number(match[1]);
    applyStepMutation(audit, stepNumber);
    applyOutcomeMutation(audit, stepNumber, options?.calibration, stackIndex);
    return;
  }

  const gap = { id: action.id } as GapFlag;
  applyGapMutation(audit, gap);
  applyOutcomeGapMutation(audit, gap, options);
}

/** Re-run scoring after applying a set of plan steps and/or gaps. */
export function projectHealthScoresFromActions(
  audit: Phase1AuditPayload,
  actions: Array<{ source: "plan" | "gap"; id: string }>,
  options?: CounterfactualProjectionOptions
): ProjectedHealthScores {
  const before = computeHealthScores(audit);
  const mutated = cloneAudit(audit);

  let planStackIndex = 0;
  for (const action of actions) {
    const stackIndex = action.source === "plan" ? planStackIndex : 0;
    applyActionMutations(mutated, action, options, stackIndex);
    if (action.source === "plan") planStackIndex += 1;
  }

  const after = computeHealthScores(mutated);
  return {
    projectedDriverScore: after.driverScore,
    projectedOverallScore: after.overall,
    driverGain: after.driverScore - before.driverScore,
    overallGain: after.overall - before.overall,
  };
}

/**
 * Stack dampening for multi-step projections — later actions claim less of the
 * remaining upside so stacked estimates stay below the sum of isolated impacts.
 */
export function stackDampeningFactor(stackIndex: number): number {
  if (stackIndex <= 0) return 1;
  if (stackIndex === 1) return 0.7;
  if (stackIndex === 2) return 0.5;
  return 0.35;
}

/** Raw monthly action lifts (calls/directions/clicks) from conversion-family plan steps. */
function conversionEngagementRawActions(
  audit: Phase1AuditPayload,
  actions: ActionRef[],
  calibration?: AttributionCalibration
): { calls: number; directions: number; websiteClicks: number } | null {
  const views = Math.max(audit.gbp.performance.profileViews, 100);
  let calls = 0;
  let directions = 0;
  let websiteClicks = 0;
  let planStackIndex = 0;
  let sawConversion = false;

  for (const action of actions) {
    if (action.source !== "plan") {
      continue;
    }
    const match = action.id.match(/^gbp-step-(\d+)$/);
    const stepNumber = match ? Number(match[1]) : NaN;
    const rates = Number.isFinite(stepNumber)
      ? conversionEngagementRates(stepNumber, views, calibration)
      : null;
    if (rates) {
      sawConversion = true;
      const gains = scaleConversionEngagementGains(
        views,
        rates,
        stackDampeningFactor(planStackIndex)
      );
      calls += gains.calls;
      directions += gains.directions;
      websiteClicks += gains.websiteClicks;
    }
    planStackIndex += 1;
  }

  if (!sawConversion || calls + directions + websiteClicks <= 0) return null;
  return { calls, directions, websiteClicks };
}

/**
 * Raw monthly leads from conversion-step engagement uplifts.
 * Uses the same plan stack index as mutations so a conversion step after a rank
 * step is dampened (not full value just because it's the first conversion).
 */
function conversionEngagementRawLeads(
  audit: Phase1AuditPayload,
  actions: ActionRef[],
  calibration?: AttributionCalibration
): number | null {
  const gains = conversionEngagementRawActions(audit, actions, calibration);
  if (!gains) return null;

  // Mirror DEFAULT_ROI_CONFIG lead rates without importing a circular path.
  return gains.calls * 0.25 + gains.directions * 0.3 + gains.websiteClicks * 0.05;
}

function conversionEngagementActionsGain(
  audit: Phase1AuditPayload,
  actions: ActionRef[],
  calibration?: AttributionCalibration
): number | null {
  const gains = conversionEngagementRawActions(audit, actions, calibration);
  if (!gains) return null;
  return gains.calls + gains.directions + gains.websiteClicks;
}

function conversionEngagementLeadsGain(
  audit: Phase1AuditPayload,
  actions: ActionRef[],
  calibration?: AttributionCalibration
): number | null {
  const raw = conversionEngagementRawLeads(audit, actions, calibration);
  return raw == null ? null : roundLeadCount(raw);
}

function conversionEngagementRevenueGain(
  audit: Phase1AuditPayload,
  actions: ActionRef[],
  avgCustomerValue?: number | null,
  calibration?: AttributionCalibration
): number | null {
  if (avgCustomerValue == null || avgCustomerValue <= 0) return null;
  const raw = conversionEngagementRawLeads(audit, actions, calibration);
  if (raw == null) return null;
  return Math.round(raw * avgCustomerValue);
}

/**
 * Project ranking outcome and revenue after applying profile + rank counterfactuals.
 *
 * Revenue channel policy:
 * - Rank-family steps → keyword CTR revenue (via rank mutations)
 * - Conversion-family steps (8/11/13/15) → engagement revenue only (no pack-rank claim)
 * - Stacked estimates dampen later plan actions with stackDampeningFactor(planStackIndex)
 */
export function projectOutcomeScoresFromActions(
  audit: Phase1AuditPayload,
  actions: ActionRef[],
  options: CounterfactualProjectionOptions = {}
): ProjectedOutcomeScores {
  const before = computeHealthScores(audit);
  const beforeRevenue = totalEstimatedRevenue(audit, options.avgCustomerValue);
  const mutated = cloneAudit(audit);

  let planStackIndex = 0;
  for (const action of actions) {
    const stackIndex = action.source === "plan" ? planStackIndex : 0;
    applyActionMutations(mutated, action, options, stackIndex);
    if (action.source === "plan") planStackIndex += 1;
  }

  const after = computeHealthScores(mutated);
  const afterRevenue = totalEstimatedRevenue(mutated, options.avgCustomerValue);
  const conversionRevenue = conversionEngagementRevenueGain(
    audit,
    actions,
    options.avgCustomerValue,
    options.calibration
  );
  const beforeLeads = totalEstimatedLeads(audit);
  const afterLeads = totalEstimatedLeads(mutated);
  const conversionLeads = conversionEngagementLeadsGain(
    audit,
    actions,
    options.calibration
  );
  const engagementActionsGain = conversionEngagementActionsGain(
    audit,
    actions,
    options.calibration
  );

  const rankRevenueGain =
    beforeRevenue != null && afterRevenue != null
      ? Math.max(0, afterRevenue - beforeRevenue)
      : null;
  // Keep 0 (not null) when revenue is estimable so marginal deltas still compute.
  const rawRevenueGain =
    rankRevenueGain != null || conversionRevenue != null
      ? (rankRevenueGain ?? 0) + (conversionRevenue ?? 0)
      : null;
  const revenueGain =
    rawRevenueGain != null
      ? calibratedRevenueGain(rawRevenueGain, actions, options.calibration)
      : null;

  const projectedMonthly =
    revenueGain != null
      ? (beforeRevenue ?? 0) + revenueGain
      : afterRevenue != null || conversionRevenue != null
        ? (afterRevenue ?? beforeRevenue ?? 0) + (conversionRevenue ?? 0)
        : null;

  const rankLeadsGain =
    beforeLeads != null && afterLeads != null
      ? Math.max(0, afterLeads - beforeLeads)
      : null;
  const rawLeadsGain =
    rankLeadsGain != null || conversionLeads != null
      ? (rankLeadsGain ?? 0) + (conversionLeads ?? 0)
      : null;
  const leadsGain = rawLeadsGain != null ? roundLeadCount(rawLeadsGain) : null;
  const projectedMonthlyLeads =
    afterLeads != null || conversionLeads != null
      ? roundLeadCount((afterLeads ?? beforeLeads ?? 0) + (conversionLeads ?? 0))
      : null;

  return {
    projectedOutcomeIndex: after.outcomeIndex,
    projectedVisibility: after.visibility,
    projectedRevenueCapture: after.revenueCapture,
    projectedOverallScore: after.overall,
    outcomeGain: after.outcomeIndex - before.outcomeIndex,
    visibilityGain: after.visibility - before.visibility,
    revenueCaptureGain: after.revenueCapture - before.revenueCapture,
    overallGain: after.overall - before.overall,
    estimatedMonthlyRevenue: projectedMonthly,
    revenueGain,
    estimatedMonthlyLeads: projectedMonthlyLeads,
    leadsGain,
    engagementActionsGain,
  };
}

/**
 * Marginal driver, outcome, and revenue deltas from adding one action on top of
 * an already-selected set. Uses full counterfactual re-scoring to avoid
 * double-counting overlapping profile changes.
 */
export function simulateActionMarginalImpact(
  audit: Phase1AuditPayload,
  selectedActions: ActionRef[],
  candidate: ActionRef,
  options?: CounterfactualProjectionOptions
): ActionMarginalImpact {
  const beforeHealth = projectHealthScoresFromActions(audit, selectedActions, options);
  const afterHealth = projectHealthScoresFromActions(
    audit,
    [...selectedActions, candidate],
    options
  );

  const beforeOutcome = projectOutcomeScoresFromActions(audit, selectedActions, options);
  const afterOutcome = projectOutcomeScoresFromActions(
    audit,
    [...selectedActions, candidate],
    options
  );

  const driverGain = Math.max(0, afterHealth.driverGain - beforeHealth.driverGain);
  const outcomeGain = Math.max(0, afterOutcome.outcomeGain - beforeOutcome.outcomeGain);
  const visibilityGain = Math.max(0, afterOutcome.visibilityGain - beforeOutcome.visibilityGain);
  const revenueCaptureGain = Math.max(
    0,
    afterOutcome.revenueCaptureGain - beforeOutcome.revenueCaptureGain
  );
  const overallGain = Math.max(0, afterHealth.overallGain - beforeHealth.overallGain);

  let revenueGain: number | null = null;
  if (beforeOutcome.revenueGain != null && afterOutcome.revenueGain != null) {
    revenueGain = Math.max(0, afterOutcome.revenueGain - beforeOutcome.revenueGain);
  }

  const engagementGain = Math.max(
    0,
    (afterOutcome.engagementActionsGain ?? 0) - (beforeOutcome.engagementActionsGain ?? 0)
  );

  return {
    driverGain,
    outcomeGain,
    visibilityGain,
    revenueCaptureGain,
    revenueGain,
    engagementGain,
    overallGain,
  };
}

/** Convenience wrapper for path-to-healthy and plan progress. */
export function projectHealthScoresFromStepNumbers(
  audit: FullAuditPayload,
  stepNumbers: number[],
  options?: CounterfactualProjectionOptions
): ProjectedHealthScores {
  return projectHealthScoresFromActions(
    audit,
    stepNumbers.map((n) => ({ source: "plan" as const, id: `gbp-step-${n}` })),
    options
  );
}

export interface SelectedAction extends ActionRef {
  marginalDriverGain: number;
  marginalOutcomeGain: number;
  marginalRevenueGain: number | null;
  marginalEngagementGain: number;
  marginalCompositeScore: number;
}

export interface ActionPickTarget {
  mode: PathOptimizationMode;
  driverPointsNeeded: number;
  outcomePointsNeeded?: number;
  revenueGainNeeded?: number | null;
}

export interface PickActionTargetOptions extends CounterfactualProjectionOptions {}

export function isActionTargetMet(
  mode: PathOptimizationMode,
  health: ProjectedHealthScores,
  outcome: ProjectedOutcomeScores,
  target: ActionPickTarget
): boolean {
  switch (mode) {
    case "outcome": {
      const effective =
        outcome.outcomeGain + engagementOutcomePoints(outcome.engagementActionsGain ?? 0);
      return effective >= (target.outcomePointsNeeded ?? target.driverPointsNeeded);
    }
    case "revenue":
      if (outcome.revenueGain != null && target.revenueGainNeeded != null) {
        return outcome.revenueGain >= target.revenueGainNeeded;
      }
      // Without ACV, engagement actions count toward a revenue-mode progress proxy.
      if ((outcome.engagementActionsGain ?? 0) > 0 && target.revenueGainNeeded == null) {
        return (
          outcome.engagementActionsGain! >= target.driverPointsNeeded ||
          health.driverGain >= target.driverPointsNeeded
        );
      }
      return health.driverGain >= target.driverPointsNeeded;
    case "driver":
    case "balanced":
    default:
      return health.driverGain >= target.driverPointsNeeded;
  }
}

/**
 * Greedily pick actions until the target is met for the chosen optimization mode.
 * Uses full counterfactual re-scoring at each pick to avoid double-counting overlaps.
 */
export function pickActionsForTarget(
  audit: Phase1AuditPayload,
  candidates: ActionRef[],
  target: ActionPickTarget,
  options?: PickActionTargetOptions
): {
  selected: SelectedAction[];
  projection: ProjectedHealthScores;
  outcomeProjection: ProjectedOutcomeScores;
} {
  const weights = resolveBlendWeights(options?.avgCustomerValue, options?.blendWeights);
  const selected: SelectedAction[] = [];
  const remaining = [...candidates];
  let projection = projectHealthScoresFromActions(audit, [], options);
  let outcomeProjection = projectOutcomeScoresFromActions(audit, [], options);

  while (!isActionTargetMet(target.mode, projection, outcomeProjection, target) && remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = 0;
    let bestImpact: ActionMarginalImpact | null = null;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const impact = simulateActionMarginalImpact(audit, selected, candidate, options);
      const score = marginalScoreForMode(impact, target.mode, weights);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
        bestImpact = impact;
      }
    }

    if (bestIndex < 0 || bestScore <= 0 || !bestImpact) break;

    const picked = remaining.splice(bestIndex, 1)[0];
    selected.push({
      ...picked,
      marginalDriverGain: bestImpact.driverGain,
      marginalOutcomeGain: bestImpact.outcomeGain,
      marginalRevenueGain: bestImpact.revenueGain,
      marginalEngagementGain: bestImpact.engagementGain,
      marginalCompositeScore: compositeMarginalScore(bestImpact, weights),
    });
    projection = projectHealthScoresFromActions(audit, selected, options);
    outcomeProjection = projectOutcomeScoresFromActions(audit, selected, options);
  }

  return { selected, projection, outcomeProjection };
}

/**
 * Greedily pick actions until cumulative driver gain meets the target.
 * Uses full counterfactual re-scoring at each pick — avoids double-counting
 * overlapping steps (e.g. description + services both moving relevance).
 */
export function pickActionsForDriverTarget(
  audit: Phase1AuditPayload,
  candidates: ActionRef[],
  pointsNeeded: number,
  options?: CounterfactualProjectionOptions
): { selected: SelectedAction[]; projection: ProjectedHealthScores } {
  const { selected, projection } = pickActionsForTarget(
    audit,
    candidates,
    { mode: "driver", driverPointsNeeded: pointsNeeded },
    options
  );
  return { selected, projection };
}
