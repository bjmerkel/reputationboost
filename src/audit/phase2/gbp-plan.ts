import type { GbpOptimizationPlan, GbpPlanStep, KeywordRankAnalysis, Phase1AuditPayload } from "../types";
import { formatStarRating } from "@/lib/format-star-rating";
import { isStepSatisfied } from "./counterfactual";
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
  allSteps: GbpPlanStep[]
): GbpPlanStep[] {
  const inventoryRequired = audit.gbp.locationInventory
    ? planStepsRequiredByInventory(audit.gbp.locationInventory)
    : new Set<number>();

  return allSteps.filter(
    (step) =>
      !isStepSatisfied(audit, step.stepNumber) || inventoryRequired.has(step.stepNumber)
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
  const photoTarget = Math.max(200, audit.gbp.content.photoCount + 80);
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
      recommended: recommendedSecondary.join(", ") || "Add categories matching your target keywords",
      bullets: [
        `Currently on profile: ${liveSecondary.length ? liveSecondary.join(", ") : "none"}`,
        ...recommendedSecondary.map((c) => `Add: ${c}`),
        "Only add categories for services you actively offer",
      ],
      gbpAction: "add_secondary_categories",
      actionData: { secondaryCategories: recommendedSecondary },
    },
    {
      stepNumber: 3,
      title: "Rewrite the Business Description",
      instruction: `Your live description is ${audit.gbp.completeness.descriptionLength} characters. Google descriptions should weave in services, city names, and trust signals. Aim for 600-750 characters with every target keyword mentioned naturally.`,
      current: currentDescription(audit),
      recommended: "Updated description below — includes all target keywords",
      copyBlocks: [{ label: "Recommended description (paste into GBP)", content: descriptionDraft(audit) }],
      gbpAction: "update_description",
      actionData: { description: descriptionDraft(audit) },
    },
    {
      stepNumber: 4,
      title: "Complete Every Service Section",
      instruction:
        "Services are one of the strongest ranking signals. Add a dedicated GBP service for each keyword you're not yet ranking for.",
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
      instruction: `Google rewards active profiles. You currently have ${audit.gbp.content.photoCount} photos — target ${photoTarget}+ to compete with pack leaders.`,
      current: `${audit.gbp.content.photoCount} photos on profile`,
      recommended: `${photoTarget}+ photos with service-specific shots for each keyword`,
      bullets: [
        "Exterior & storefront: 10 photos",
        "Interior / team / fleet shots: 20+ photos",
        ...outcomePriorityRankings(keywordRankings)
          .slice(0, 4)
          .map((k) => `Add photos for "${k.keyword}" service (${k.position})`),
        "Upload 5+ new photos every week",
      ],
      gbpAction: "upload_photo",
    },
    {
      stepNumber: 7,
      title: "Videos",
      instruction: "Upload 2-4 short videos weekly (30-60 seconds each) to boost engagement signals.",
      current:
        audit.gbp.content.videoCount > 0
          ? `${audit.gbp.content.videoCount} videos on profile`
          : "No videos on profile yet",
      recommended: "2-4 videos per week showcasing your top services",
      bullets: targetKeywords.slice(0, 4).map((kw) => `Short video featuring ${kw}`),
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
        "Spectrum plan includes account-manager escalation for high-impact disputes",
      ],
    },
    {
      stepNumber: 10,
      title: "Request more reviews",
      instruction:
        "Send personalized SMS review requests to recent customers. More Google reviews strengthen rankings — especially for keywords where you trail competitors on review count.",
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
      instruction: "Inconsistent hours hurt rankings and customer trust.",
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

  const portfolioStep = buildKeywordPortfolioPlanStep(audit);
  if (portfolioStep) {
    steps.push(portfolioStep);
  }

  return steps;
}

export function buildTemplateGbpPlan(audit: Phase1AuditPayload): GbpOptimizationPlan {
  const targetKeywords = keywords(audit);
  const currentState = buildGbpCurrentState(audit);
  const keywordRankings = buildKeywordRankAnalysis(audit);
  const allSteps = buildAllGbpPlanSteps(audit);
  const steps = selectGbpPlanSteps(audit, allSteps);

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
      "Add or update products",
      "Upload service-specific photo batches",
      "Refresh business description if offerings changed",
    ],
    contentSource: "template",
  };
}
