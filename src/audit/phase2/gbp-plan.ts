import type { GbpOptimizationPlan, GbpPlanStep, KeywordRankAnalysis, Phase1AuditPayload } from "../types";
import { formatStarRating } from "@/lib/format-star-rating";
import { isStepSatisfied, simulateStepDriverImpact } from "./counterfactual";
import {
  auditNeedsConversionBoost,
  auditNeedsSoftConversionBoost,
  auditPrefersConversionOverRank,
} from "./conversion-boost";
import {
  conversionLeversForChannel,
  resolveConversionChannelBias,
  type ConversionChannelBias,
} from "./conversion-channel";
import { CONVERSION_PLAN_STEPS } from "./conversion-constants";
import {
  negativeEvidencePenalty,
  type AttributionCalibration,
} from "./attribution-calibration";
import {
  estimateStepEngagementImpact,
  estimateStepLeadsImpact,
  estimateStepOutcomeImpact,
  estimateStepRevenueImpact,
} from "./score-impact";
import { planStepsRequiredByInventory } from "@/lib/google/gbp-field-plan-map";
import { buildServicePlanBlocks, buildOutcomePriorityServiceBlocks } from "@/lib/google/gbp-service-descriptions";
import {
  buildAttributePlanContent,
  buildGbpCurrentState,
  buildKeywordRankAnalysis,
  inferRecommendedSecondaryCategories,
  missingKeywordsForServices,
} from "./gbp-current-state";
import {
  computeKeywordPortfolio,
  KEYWORD_PORTFOLIO_PLAN_STEP,
  portfolioStepIsSatisfied,
} from "./keyword-portfolio";
import { buildGbpDescriptionDraft, cityFromAddress } from "@/lib/google/gbp-description-draft";
import { resolveReviewResponseRate } from "@/audit/review-engagement";

export interface GbpPlanBuildOptions {
  avgCustomerValue?: number | null;
  /** Closed-loop attribution blend for displayOrder / impact ranking. */
  calibration?: AttributionCalibration;
  preferredConversionChannel?: ConversionChannelBias;
}

export { auditNeedsConversionBoost } from "./conversion-boost";
export { CONVERSION_PLAN_STEPS } from "./conversion-constants";

const CONVERSION_BOOST_STEPS = new Set<number>(CONVERSION_PLAN_STEPS);

/** Relative effort (1 easy → 10 hard) — used so fast CTR wins beat slow busywork. */
export const PLAN_STEP_EFFORT: Record<number, number> = {
  0: 1,
  1: 3,
  2: 3,
  3: 4,
  4: 4,
  5: 4,
  6: 6,
  7: 5,
  8: 3,
  9: 5,
  10: 7,
  11: 3,
  12: 3,
  13: 2,
  14: 2,
  15: 2,
  17: 4,
};

/** Rank plan steps by estimated revenue, then outcome, then driver impact. */
export function planStepImpactScore(
  audit: Phase1AuditPayload,
  stepNumber: number,
  avgCustomerValue?: number | null,
  calibration?: AttributionCalibration,
  preferredConversionChannel?: ConversionChannelBias
): number {
  const revenue =
    estimateStepRevenueImpact(audit, stepNumber, avgCustomerValue, calibration) ?? 0;
  // When ACV is missing, rank/conversion lead estimates still differentiate impact order.
  const leads =
    revenue > 0 ? 0 : (estimateStepLeadsImpact(audit, stepNumber, calibration) ?? 0);
  const engagement = estimateStepEngagementImpact(audit, stepNumber, calibration) ?? 0;
  const outcome = estimateStepOutcomeImpact(audit, stepNumber, calibration);
  const driver = simulateStepDriverImpact(audit, stepNumber);
  let score =
    revenue * 1000 + leads * 50 + engagement * 10 + outcome * 10 + driver;
  // When views don't convert, elevate CTA/place-action/trust work over pure completeness.
  if (auditNeedsConversionBoost(audit) && CONVERSION_BOOST_STEPS.has(stepNumber)) {
    if (auditNeedsSoftConversionBoost(audit)) {
      const zeroActions =
        audit.gbp.performance.calls +
          audit.gbp.performance.directionRequests +
          audit.gbp.performance.websiteClicks ===
        0;
      score += zeroActions ? 40 : 30;
    } else {
      score += 50;
      // Already mostly in-pack → conversion work should outrank volume/completeness.
      if (auditPrefersConversionOverRank(audit)) {
        score += 75;
      }
    }
    const preferred = conversionLeversForChannel(
      resolveConversionChannelBias(audit, {
        preferredChannel: preferredConversionChannel,
      })
    );
    const channelRank = preferred.indexOf(stepNumber);
    if (channelRank >= 0) {
      score += (preferred.length - channelRank) * 5;
    }
  }
  // Demote media busywork when the listing is visible but under-converting, or
  // when photo/video coverage is already adequate.
  if (stepNumber === 6 || stepNumber === 7) {
    if (auditPrefersConversionOverRank(audit)) {
      score *= 0.25;
    } else if (stepNumber === 6 && audit.gbp.content.photoCount >= 40) {
      score *= 0.5;
    } else if (stepNumber === 7 && audit.gbp.content.videoCount >= 1) {
      score *= 0.4;
    }
  }
  const effort = PLAN_STEP_EFFORT[stepNumber] ?? 4;
  score *= (11 - effort) / 10;
  score *= negativeEvidencePenalty(stepNumber, calibration);
  return score;
}

/** Sort steps by impact and stamp displayOrder (0-based). */
export function orderGbpPlanStepsByImpact(
  audit: Phase1AuditPayload,
  steps: GbpPlanStep[],
  avgCustomerValue?: number | null,
  calibration?: AttributionCalibration,
  preferredConversionChannel?: ConversionChannelBias
): GbpPlanStep[] {
  return [...steps]
    .sort(
      (a, b) =>
        planStepImpactScore(
          audit,
          b.stepNumber,
          avgCustomerValue,
          calibration,
          preferredConversionChannel
        ) -
        planStepImpactScore(
          audit,
          a.stepNumber,
          avgCustomerValue,
          calibration,
          preferredConversionChannel
        )
    )
    .map((step, index) => ({ ...step, displayOrder: index }));
}

/** Continuous Activity (16) was a cadence summary, not an actionable step. */
const RETIRED_GBP_PLAN_STEP_NUMBERS = new Set([16]);

/** Checklist steps that can't be enabled or updated via GBP APIs. */
const RETIRED_GBP_PLAN_STEP_TITLES = new Set(["Messaging", "Booking Feature", "Continuous Activity"]);

export function isRetiredGbpPlanStep(stepNumber: number, title?: string): boolean {
  if (RETIRED_GBP_PLAN_STEP_NUMBERS.has(stepNumber)) return true;
  if (title && RETIRED_GBP_PLAN_STEP_TITLES.has(title)) return true;
  return false;
}

/** Gap-driven steps for API-managed alerts and place action links (replacing Messaging / Booking Feature). */
export const NOTIFICATIONS_PLAN_STEP = 14;
export const PLACE_ACTIONS_PLAN_STEP = 15;

function keywords(audit: Phase1AuditPayload): string[] {
  return audit.rankings.keywords.map((k) => k.keyword);
}

/** Keywords outside the 3-Pack or pack-fragile at wider radii — highest plan priority. */
function outcomePriorityRankings(keywordRankings: KeywordRankAnalysis[]): KeywordRankAnalysis[] {
  return keywordRankings.filter((k) => !k.inLocalPack || k.packFragile);
}

export function selectGbpPlanSteps(
  audit: Phase1AuditPayload,
  allSteps: GbpPlanStep[],
  options: GbpPlanBuildOptions = {}
): GbpPlanStep[] {
  const inventoryRequired = audit.gbp.locationInventory
    ? planStepsRequiredByInventory(audit.gbp.locationInventory)
    : new Set<number>();

  const selected = allSteps.filter(
    (step) =>
      !isStepSatisfied(audit, step.stepNumber) || inventoryRequired.has(step.stepNumber)
  );
  return orderGbpPlanStepsByImpact(
    audit,
    selected,
    options.avgCustomerValue,
    options.calibration,
    options.preferredConversionChannel
  );
}

export {
  categoryLabelsMatch,
  normalizeCategoryLabel,
  primaryCategoryUpdateIsNoOp,
  resolveLivePrimaryCategory,
  resolveRecommendedPrimaryCategory,
} from "./gbp-category";
import {
  resolveLivePrimaryCategory,
  resolveRecommendedPrimaryCategory,
} from "./gbp-category";

function descriptionDraft(audit: Phase1AuditPayload): string {
  return buildGbpDescriptionDraft(audit);
}

function serviceSteps(audit: Phase1AuditPayload): GbpPlanStep["copyBlocks"] {
  return buildServicePlanBlocks(audit).map((block) => ({
    label: block.label,
    content: block.content,
  }));
}

function priorityServiceSteps(
  audit: Phase1AuditPayload,
  keywordRankings: KeywordRankAnalysis[]
): GbpPlanStep["copyBlocks"] {
  return buildOutcomePriorityServiceBlocks(audit, keywordRankings).map((block) => ({
    label: block.label,
    content: block.content,
  }));
}

function currentDescription(audit: Phase1AuditPayload): string {
  const desc = audit.gbp.liveProfile?.description ?? "";
  if (!desc) return "No description on your Google profile";
  const len = desc.length;
  return `${len} characters: "${desc.slice(0, 200)}${len > 200 ? "…" : ""}"`;
}

function currentServices(audit: Phase1AuditPayload): string {
  const services = audit.gbp.liveProfile?.services ?? [];
  if (services.length === 0) return "No services listed on your profile";
  return services.map((s) => s.name).join(", ");
}

function currentPosts(audit: Phase1AuditPayload): string {
  const posts = audit.gbp.recentPosts ?? [];
  if (posts.length === 0) return "No recent Google Posts";
  const latest = posts[0];
  const days = Math.floor(
    (Date.now() - new Date(latest.createTime).getTime()) / (1000 * 60 * 60 * 24)
  );
  return `Last post ${days} days ago: "${latest.summary.slice(0, 100)}${latest.summary.length > 100 ? "…" : ""}"`;
}

function buildKeywordPortfolioPlanStep(audit: Phase1AuditPayload): GbpPlanStep | null {
  const portfolio = audit.keywordPortfolio ?? computeKeywordPortfolio(audit);
  if (portfolioStepIsSatisfied(audit)) return null;
  if (
    !portfolio.shouldRotate &&
    portfolio.untrackedDemandCount === 0 &&
    portfolio.rankWithoutDemandCount === 0
  ) {
    return null;
  }

  const currentKeywords = keywords(audit).join(", ");
  const recommended = portfolio.recommendedKeywords.join(", ");

  return {
    stepNumber: KEYWORD_PORTFOLIO_PLAN_STEP,
    title: "Align keyword portfolio",
    instruction: `${portfolio.summary} Approve to update your tracked keywords to match Google search demand. Scheduled rank pulses and monthly heatmaps will follow the optimized set.`,
    current: currentKeywords,
    recommended,
    bullets: [
      `Demand alignment: ${portfolio.demandAlignmentScore}%`,
      ...portfolio.recommendedSwaps.slice(0, 4).map(
        (swap) => `Swap "${swap.swapOut}" → "${swap.swapIn}"${swap.estimatedImpressionGain ? ` (+${swap.estimatedImpressionGain} impressions/mo)` : ""}`
      ),
      ...(portfolio.untrackedCandidates[0]
        ? [`Top untracked GBP term: "${portfolio.untrackedCandidates[0].keyword}"`]
        : []),
    ],
    gbpAction: "manual",
  };
}

export function buildAllGbpPlanSteps(audit: Phase1AuditPayload): GbpPlanStep[] {
  const targetKeywords = keywords(audit);
  const city = cityFromAddress(audit.gbp.identity.address);
  const category = audit.gbp.identity.primaryCategory;
  const reviewTarget = Math.max(200, audit.gbp.engagement.reviewCount + 50);
  const mediaCoverage = audit.gbp.content.mediaCoverage;
  const missingPhotoCategories = mediaCoverage?.missingCategories?.length
    ? mediaCoverage.missingCategories
    : ["Exterior", "At work", "Team"];
  const keywordRankings = buildKeywordRankAnalysis(audit);
  const recommendedSecondary = inferRecommendedSecondaryCategories(audit);
  const liveSecondary =
    audit.gbp.liveProfile?.secondaryCategories ?? audit.gbp.identity.secondaryCategories;

  const steps: GbpPlanStep[] = [
    {
      stepNumber: 1,
      title: "Primary Category",
      instruction:
        "The primary category carries the most weight for Google Maps relevance. Your current category is shown below — update only if audit keywords suggest a better fit.",
      current: resolveLivePrimaryCategory(audit) || category,
      recommended: resolveRecommendedPrimaryCategory(audit) || category,
      bullets: [
        `Current: ${resolveLivePrimaryCategory(audit) || category}`,
        "Primary category should match your core revenue service and top keywords",
        "Do not switch categories frequently — stability signals trust",
      ],
      gbpAction: "update_primary_category",
      actionData: { primaryCategory: resolveRecommendedPrimaryCategory(audit) || category },
    },
    {
      stepNumber: 2,
      title: "Add Secondary Categories",
      instruction:
        "Secondary categories expand relevance for related searches. Compare what's live on your profile vs what keywords need coverage.",
      current: liveSecondary.length ? liveSecondary.join(", ") : "None listed",
      recommended: recommendedSecondary.length
        ? recommendedSecondary.join(", ")
        : "Add categories matching your target keywords (not your primary category)",
      bullets: [
        `Currently on profile: ${liveSecondary.length ? liveSecondary.join(", ") : "none"}`,
        ...recommendedSecondary.map((c) => `Add: ${c}`),
        "Only add categories for services you actively offer",
        "Do not add your primary category as a secondary — Google requires unique categories",
      ],
      gbpAction: "add_secondary_categories",
      actionData: { secondaryCategories: recommendedSecondary },
    },
    {
      stepNumber: 3,
      title: "Rewrite the Business Description",
      instruction: `Your live description is ${audit.gbp.completeness.descriptionLength} characters. Write a clear, accurate summary of your services and service area (600–750 characters). Mention what you do and where you work naturally — avoid keyword stuffing or repeating the same phrases.`,
      current: currentDescription(audit),
      recommended: "Updated description below — accurate services, city, and trust signals",
      copyBlocks: [{ label: "Recommended description (paste into GBP)", content: descriptionDraft(audit) }],
      gbpAction: "update_description",
      actionData: { description: descriptionDraft(audit) },
    },
    {
      stepNumber: 4,
      title: "Complete Every Service Section",
      instruction:
        "Services help customers and Google understand what you offer (relevance). Add a dedicated GBP service for each major offering or keyword gap — use natural names and unique descriptions.",
      current: currentServices(audit),
      recommended: `Add ${missingKeywordsForServices(audit).length || targetKeywords.length} service(s) for uncovered keywords`,
      copyBlocks: serviceSteps(audit),
      bullets: [
        `Currently listed: ${currentServices(audit)}`,
        `Missing keywords as services: ${missingKeywordsForServices(audit).join(", ") || "none — maintain and expand"}`,
        "Each service needs its own unique description",
      ],
      gbpAction: "add_service_items",
    },
    {
      stepNumber: 5,
      title: "Priority Keyword Services",
      instruction:
        "Reinforce keywords outside the 3-Pack or fragile at wider search radii by adding dedicated GBP services. Each service needs a display name (≤140 characters) and a unique description (≤250 characters, plain text — no phone numbers or URLs). Approve & publish adds them via the Google Business Profile Services API.",
      current: currentServices(audit),
      recommended: `Add services for: ${outcomePriorityRankings(keywordRankings).map((k) => k.keyword).join(", ") || targetKeywords[0]}`,
      copyBlocks: priorityServiceSteps(audit, keywordRankings),
      bullets: [
        `Currently listed: ${currentServices(audit)}`,
        `Priority keywords: ${outcomePriorityRankings(keywordRankings).map((k) => k.keyword).join(", ") || "none"}`,
        "Use copyBlocks with label format Service #N: {displayName} and a paste-ready description",
        "Do not duplicate services already on your profile",
      ],
      gbpAction: "add_service_items",
    },
    {
      stepNumber: 6,
      title: "Photo Optimization",
      instruction: `Fill photo coverage gaps (not an arbitrary total). You have ${audit.gbp.content.photoCount} photos${
        mediaCoverage ? ` · coverage score ${mediaCoverage.coverageScore}` : ""
      }. Prioritize missing categories and service shots for keywords outside the 3-Pack.`,
      current: mediaCoverage
        ? `${audit.gbp.content.photoCount} photos · coverage ${mediaCoverage.coverageScore} · missing: ${
            mediaCoverage.missingCategories.join(", ") || "none"
          }`
        : `${audit.gbp.content.photoCount} photos on profile`,
      recommended: `Cover ${missingPhotoCategories.slice(0, 4).join(", ")} plus service shots for priority keywords`,
      bullets: [
        ...missingPhotoCategories.slice(0, 4).map((label) => `Add: ${label}`),
        ...outcomePriorityRankings(keywordRankings)
          .slice(0, 3)
          .map((k) => `Service photos for "${k.keyword}" (${k.position})`),
        "Skip bulk uploads once coverage and trust categories are filled",
      ],
      gbpAction: "upload_photo",
    },
    {
      stepNumber: 7,
      title: "Videos",
      instruction:
        "Add at least one short service video for a top keyword. Extra weekly videos help cadence, but one strong clip unblocks this step.",
      current:
        audit.gbp.content.videoCount > 0
          ? `${audit.gbp.content.videoCount} videos on profile`
          : "No videos on profile yet",
      recommended: "1+ short video featuring a priority service/keyword",
      bullets: targetKeywords.slice(0, 3).map((kw) => `Short video featuring ${kw}`),
      gbpAction: "upload_video",
    },
    {
      stepNumber: 8,
      title: "Weekly Google Posts",
      instruction:
        "Post every week. Rotate posts around keywords outside the 3-Pack or pack-fragile at wider radii — include a photo, 150-300 words, and a call button.",
      current: currentPosts(audit),
      recommended: "1 post per week, prioritizing outside-pack and service-area-fragile keywords",
      bullets: outcomePriorityRankings(keywordRankings)
        .slice(0, 6)
        .map((k, i) => `Week ${i + 1}: Post targeting "${k.keyword}" (${k.position})`),
      gbpAction: "create_post",
      actionData: {
        // No phone numbers or URLs in post text — Google rejects them; the
        // post's Call button links to the verified profile number.
        postSummary: `Looking for ${targetKeywords[0]} in ${city}? ${audit.clientName} delivers professional ${category} with ${audit.gbp.engagement.reviewCount}+ reviews. Tap Call to reach our team today.`,
      },
    },
    {
      stepNumber: 9,
      title: "Dispute Illegitimate Reviews",
      instruction:
        "Flag and dispute policy-violating reviews that drag down your rating. Each candidate is pre-classified with evidence templates — approve to track, then submit through Google Business Profile. Successful removals can lift your Reputation Boost Score.",
      current: `${audit.reviews.disputeCandidates.length} dispute candidate(s) · ${formatStarRating(audit.gbp.engagement.averageRating)}★ average`,
      recommended: "Dispute fake, spam, or off-topic reviews; respond to legitimate negatives in Step 11",
      bullets: [
        ...audit.reviews.reviews
          .filter((r) => audit.reviews.disputeCandidates.includes(r.id))
          .slice(0, 4)
          .map(
            (r) =>
              `${r.rating}★ from ${r.isAnonymous ? "Anonymous" : r.author.split(" ")[0]} — ${(r.text || "no text").slice(0, 80)}${(r.text?.length ?? 0) > 80 ? "…" : ""}`
          ),
        "Google has no public API for disputes — we guide you with one-click evidence and track outcomes",
        "After you mark a dispute submitted, we queue the same review again — Google often needs multiple reports",
        "Spectrum plan includes account-manager escalation for high-impact disputes",
      ],
    },
    {
      stepNumber: 10,
      title: "Request more reviews",
      instruction:
        "Send personalized SMS review requests to recent customers. More Google reviews can improve prominence — especially for keywords where you trail competitors on review count.",
      current: `${audit.gbp.engagement.reviewCount} reviews at ${formatStarRating(audit.gbp.engagement.averageRating)}★`,
      recommended: `${reviewTarget}+ reviews with keyword-rich natural language`,
      bullets: [
        ...keywordRankings
          .filter((k) => k.reviewGap > 20)
          .slice(0, 4)
          .map(
            (k) =>
              `"${k.keyword}": you have ${k.clientReviews} reviews vs leader's ${k.packLeaderReviews} (${k.reviewGap} gap)`
          ),
        ...targetKeywords.map((kw) => `Request reviews that naturally mention "${kw}"`),
      ],
    },
    {
      stepNumber: 11,
      title: "Review Responses",
      instruction:
        "Respond to every review within 24 hours. Mention the service and city naturally in your reply. Each response in Take Action is AI-drafted for that specific review.",
      current: `${Math.round(resolveReviewResponseRate(audit) * 100)}% response rate · ${audit.reviews.unrespondedNegative} unresponded negative`,
      recommended: "100% response rate within 24 hours",
      bullets: [
        `Respond to ${audit.reviews.unrespondedNegative} unresponded negative review(s) immediately`,
        "Approve personalized replies in Take Action before publishing",
      ],
    },
    {
      stepNumber: 12,
      title: "Maintain Accurate Hours",
      instruction: "Inconsistent hours hurt customer trust and local visibility.",
      current: audit.gbp.completeness.hasHours
        ? audit.gbp.completeness.hasHolidayHours
          ? audit.gbp.completeness.hasFullWeekHours
            ? "Regular + holiday hours configured"
            : "Regular hours set · full week coverage missing"
          : "Regular hours set · holiday hours missing"
        : "Hours not detected on profile",
      recommended: "Accurate regular hours + holiday/special hours",
      bullets: [
        "Keep regular hours accurate — update for holidays",
        audit.gbp.completeness.hasFullWeekHours
          ? "Weekly hours: full coverage ✓"
          : "Add open days for Mon–Sat (or your operating days)",
        audit.gbp.completeness.hasHolidayHours
          ? "Holiday hours: major holidays configured ✓"
          : "Add major US holidays for the full year",
      ],
      gbpAction: "update_hours",
    },
    {
      stepNumber: 13,
      title: "Attributes",
      instruction:
        "Enable every applicable attribute to strengthen relevance and trust. Google exposes category-specific attributes — fill out all that apply to your business.",
      ...buildAttributePlanContent(audit),
      gbpAction: "update_attributes",
    },
  ];

  // Gap-driven conversion steps (also task-generated); include when unsatisfied so
  // LLM/template plans can prioritize views→actions work.
  if (!isStepSatisfied(audit, PLACE_ACTIONS_PLAN_STEP)) {
    steps.push({
      stepNumber: PLACE_ACTIONS_PLAN_STEP,
      title: "Place action links",
      instruction:
        "Add booking, ordering, or shop links so customers can act directly from Google Maps — critical when you get profile views without calls or directions.",
      current:
        audit.gbp.placeActions?.configuredTypes.length
          ? `${audit.gbp.placeActions.configuredTypes.length} link type(s) configured`
          : "No place action links configured",
      recommended: "Add appointment, ordering, or shop links matching your services",
      bullets: [
        "Place action links appear as buttons on your Maps listing",
        "Prioritize when profile views are high but calls/directions are low",
      ],
      gbpAction: "manual",
    });
  }

  if (!isStepSatisfied(audit, NOTIFICATIONS_PLAN_STEP)) {
    steps.push({
      stepNumber: NOTIFICATIONS_PLAN_STEP,
      title: "Real-time GBP alerts",
      instruction:
        "Subscribe to Pub/Sub alerts for new reviews and Google edits so you can respond before competitors do.",
      current: audit.gbp.notifications?.configured
        ? "Alerts partially configured"
        : "No real-time GBP alerts configured",
      recommended: "Enable review, Google update, and Voice of Merchant alerts",
      gbpAction: "manual",
    });
  }

  const portfolioStep = buildKeywordPortfolioPlanStep(audit);
  if (portfolioStep) {
    steps.push(portfolioStep);
  }

  return steps;
}

export function buildTemplateGbpPlan(
  audit: Phase1AuditPayload,
  options: GbpPlanBuildOptions = {}
): GbpOptimizationPlan {
  const targetKeywords = keywords(audit);
  const currentState = buildGbpCurrentState(audit);
  const keywordRankings = buildKeywordRankAnalysis(audit);
  const allSteps = buildAllGbpPlanSteps(audit);
  const steps = selectGbpPlanSteps(audit, allSteps, options);

  const outsidePack = keywordRankings.filter((k) => !k.inLocalPack).length;
  const fragilePack = keywordRankings.filter((k) => k.packFragile).length;

  const objectiveFocus =
    outsidePack > 0 && fragilePack > 0
      ? `the ${outsidePack} keyword(s) outside the 3-Pack and ${fragilePack} pack-fragile at wider radii`
      : outsidePack > 0
        ? `the ${outsidePack} keyword(s) outside the 3-Pack`
        : fragilePack > 0
          ? `${fragilePack} keyword(s) that drop out of the pack beyond 1 mi`
          : "all target keywords";

  return {
    title: "Google Business Profile Optimization Report",
    businessName: audit.clientName,
    address: audit.gbp.identity.address,
    objective: `${audit.clientName} is in the 3-Pack for ${audit.rankings.keywordsInPack} of ${audit.rankings.totalKeywords} keywords (${audit.rankings.shareOfVoice}% share of voice). This plan uses your live GBP profile data and multi-radius rankings to recommend profile updates that improve visibility for ${objectiveFocus}.`,
    targetKeywords,
    currentState,
    keywordRankings,
    steps,
    keywordPriority: keywordRankings
      .slice()
      .sort((a, b) => {
        const score = (k: KeywordRankAnalysis) =>
          (!k.inLocalPack ? 2 : 0) + (k.packFragile ? 1 : 0);
        return score(b) - score(a);
      })
      .map((kr, i) => ({
      rank: i + 1,
      keyword: kr.keyword,
      reason: kr.packFragile
        ? `${kr.position} — strengthen service-area visibility with posts and reviews.`
        : kr.inLocalPack
          ? `In 3-Pack at ${kr.position} — defend and strengthen profile relevance.`
          : `${kr.position} — ${kr.gbpUpdates[0] ?? "Optimize GBP for this keyword."}`,
    })),
    weeklyCadence: [
      "5 new photos",
      "2 videos",
      "1 Google Post (rotate outside-pack and pack-fragile keywords)",
      "Respond to all new reviews",
    ],
    monthlyCadence: [
      "Add 3-5 new GBP services for uncovered keywords",
      "Refresh priority-keyword service descriptions",
      "Upload service-specific photo batches",
      "Refresh business description if offerings changed",
    ],
    contentSource: "template",
  };
}
