import type { GbpOptimizationPlan, GbpPlanStep, Phase1AuditPayload } from "../types";
import { isStepSatisfied } from "./counterfactual";
import {
  buildGbpCurrentState,
  buildKeywordRankAnalysis,
  inferRecommendedSecondaryCategories,
  missingKeywordsForServices,
} from "./gbp-current-state";

function keywords(audit: Phase1AuditPayload): string[] {
  return audit.rankings.keywords.map((k) => k.keyword);
}

function cityFromAddress(address: string): string {
  const parts = address.split(",");
  return parts.length > 1 ? parts[parts.length - 2]?.trim() ?? "your area" : "your area";
}

function descriptionDraft(audit: Phase1AuditPayload): string {
  const city = cityFromAddress(audit.gbp.identity.address);
  const kwList = keywords(audit).join(", ");
  const category = audit.gbp.identity.primaryCategory;
  const reviews = audit.gbp.engagement.reviewCount;
  const rating = audit.gbp.engagement.averageRating;

  return `${audit.clientName} provides professional ${category} throughout ${city} and surrounding areas. We specialize in ${kwList}. With ${reviews}+ Google reviews (${rating}★), ${audit.clientName} delivers reliable service, clean vehicles, punctual arrivals, and professional staff. Call ${audit.gbp.identity.phone} for 24/7 availability.`;
}

function serviceSteps(audit: Phase1AuditPayload): GbpPlanStep["copyBlocks"] {
  const missing = missingKeywordsForServices(audit);
  const toAdd = missing.length > 0 ? missing : keywords(audit);
  const city = cityFromAddress(audit.gbp.identity.address);

  return toAdd.map((kw, i) => ({
    label: `Service #${i + 1}: ${kw}`,
    content: `Add "${kw}" as a named service with a 2-3 sentence description mentioning ${city}, the specific use cases customers search for, and what makes ${audit.clientName} the trusted local choice.`,
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

  return [
    {
      stepNumber: 1,
      title: "Primary Category",
      instruction:
        "The primary category carries the most weight for Google Maps relevance. Your current category is shown below — update only if audit keywords suggest a better fit.",
      current: audit.gbp.liveProfile?.primaryCategory || category,
      recommended: category,
      bullets: [
        `Current: ${audit.gbp.liveProfile?.primaryCategory || category}`,
        "Primary category should match your core revenue service and top keywords",
        "Do not switch categories frequently — stability signals trust",
      ],
      gbpAction: "update_primary_category",
      actionData: { primaryCategory: category },
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
      title: "Products Section",
      instruction:
        "Most local businesses ignore Products. Create one product per core keyword to reinforce relevance for keywords outside the 3-Pack.",
      current: "Check Products tab in GBP — not synced via API",
      recommended: `Create products for: ${targetKeywords.filter((k) => !keywordRankings.find((r) => r.keyword === k)?.inLocalPack).join(", ") || targetKeywords[0]}`,
      copyBlocks: targetKeywords
        .filter((kw) => !keywordRankings.find((r) => r.keyword === kw)?.inLocalPack)
        .slice(0, 5)
        .map((kw) => ({
          label: `Product: ${kw}`,
          content: `Create a product titled "${kw}" with a starting price, photo, and a 2-sentence description focused on ${city} customers.`,
        })),
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
        ...targetKeywords
          .filter((kw) => !keywordRankings.find((r) => r.keyword === kw)?.inLocalPack)
          .slice(0, 4)
          .map((kw) => `Add photos for "${kw}" service`),
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
        "Post every week. Rotate posts around keywords where you're outside the 3-Pack — include a photo, 150-300 words, and a call button.",
      current: currentPosts(audit),
      recommended: "1 post per week, prioritizing keywords not in the 3-Pack",
      bullets: keywordRankings
        .filter((k) => !k.inLocalPack)
        .slice(0, 6)
        .map((k, i) => `Week ${i + 1}: Post targeting "${k.keyword}" (${k.position})`),
      gbpAction: "create_post",
      actionData: {
        postSummary: `Looking for ${targetKeywords[0]} in ${city}? ${audit.clientName} delivers professional ${category} with ${audit.gbp.engagement.reviewCount}+ reviews. Call ${audit.gbp.identity.phone} today.`,
      },
    },
    {
      stepNumber: 9,
      title: "Q&A Section",
      instruction:
        "Seed questions customers actually search for. Answer every question on your profile — unanswered Q&As hurt trust.",
      current: `${audit.gbp.content.qaCount} questions · ${audit.gbp.content.unansweredQa} unanswered`,
      recommended: "15-25 Q&A pairs covering each target keyword and service area",
      copyBlocks: targetKeywords.slice(0, 3).map((kw) => ({
        label: `Q: Do you provide ${kw.toLowerCase()}?`,
        content: `Yes, ${audit.clientName} offers ${kw.toLowerCase()} throughout ${city} and surrounding areas. Call ${audit.gbp.identity.phone} for availability.`,
      })),
      bullets: [
        ...(audit.gbp.qaItems ?? []).slice(0, 3).map((q) => `Existing: "${q.question}" (${q.answerCount} answers)`),
        `Answer all ${audit.gbp.content.unansweredQa} unanswered Q&As`,
      ],
    },
    {
      stepNumber: 10,
      title: "Reviews Strategy",
      instruction: `Reviews are one of the strongest ranking factors. Target ${reviewTarget}+ total reviews. Focus on keywords where you're behind the pack leader on review count.`,
      current: `${audit.gbp.engagement.reviewCount} reviews at ${audit.gbp.engagement.averageRating}★`,
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
      current: `${Math.round(audit.gbp.engagement.responseRate * 100)}% response rate · ${audit.reviews.unrespondedNegative} unresponded negative`,
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
          ? "Holiday hours: configured ✓"
          : "Add holiday hours — currently missing",
      ],
      gbpAction: "update_hours",
    },
    {
      stepNumber: 13,
      title: "Attributes",
      instruction: "Enable every applicable attribute to strengthen relevance and trust.",
      current:
        (audit.gbp.liveProfile?.attributes ?? []).length > 0
          ? (audit.gbp.liveProfile?.attributes ?? []).join(", ")
          : "No attributes detected",
      recommended: "Enable all applicable business attributes",
      bullets: [
        "Online appointments / booking",
        "Accessibility, ownership, and identity attributes where applicable",
        `Currently ${audit.gbp.completeness.attributeCount} attributes on profile`,
      ],
      gbpAction: "update_attributes",
    },
    {
      stepNumber: 14,
      title: "Messaging",
      instruction: "Turn on GBP chat/messages and respond within minutes when possible.",
      current: "Check Messaging tab in GBP",
      recommended: "Enable messaging with fast response times",
      bullets: [
        "Fast response rates increase engagement signals",
        "Set up mobile notifications for new messages",
      ],
    },
    {
      stepNumber: 15,
      title: "Booking Feature",
      instruction: "Enable online booking or appointment links if available.",
      current: audit.gbp.identity.website || "No website linked",
      recommended: `Link booking to ${audit.gbp.identity.website || "your booking page"}`,
      bullets: [
        "Booking creates conversion signals directly inside Google",
        "Use your website URL if you accept online bookings",
      ],
      gbpAction: "update_website",
      actionData: { websiteUri: audit.gbp.identity.website },
    },
    {
      stepNumber: 16,
      title: "Continuous Activity",
      instruction:
        "Google favors active profiles. Execute this cadence consistently for 6-12 months to move keywords into the Top 3.",
      current: `${audit.rankings.keywordsInPack}/${audit.rankings.totalKeywords} keywords in 3-Pack (${audit.rankings.shareOfVoice}% share of voice)`,
      recommended: "Top 3 for all target keywords within 6-12 months",
      bullets: [
        "Weekly: 5 new photos, 2 videos, 1 Google Post, respond to all reviews, answer new Q&As",
        "Monthly: add 3-5 services, add new products, upload event photos, refresh descriptions",
        ...keywordRankings
          .filter((k) => !k.inLocalPack)
          .slice(0, 3)
          .map((k) => `Priority keyword: "${k.keyword}" — ${k.position}`),
      ],
    },
  ];
}

export function buildTemplateGbpPlan(audit: Phase1AuditPayload): GbpOptimizationPlan {
  const targetKeywords = keywords(audit);
  const currentState = buildGbpCurrentState(audit);
  const keywordRankings = buildKeywordRankAnalysis(audit);
  const allSteps = buildAllGbpPlanSteps(audit);
  const steps = allSteps.filter((step) => !isStepSatisfied(audit, step.stepNumber));

  const outsidePack = keywordRankings.filter((k) => !k.inLocalPack).length;

  return {
    title: "Google Business Profile Optimization Report",
    businessName: audit.clientName,
    address: audit.gbp.identity.address,
    objective: `${audit.clientName} is in the 3-Pack for ${audit.rankings.keywordsInPack} of ${audit.rankings.totalKeywords} keywords (${audit.rankings.shareOfVoice}% share of voice). This plan uses your live GBP profile data and current rankings to recommend specific profile updates that improve visibility for ${outsidePack > 0 ? `the ${outsidePack} keyword(s) outside the 3-Pack` : "all target keywords"}.`,
    targetKeywords,
    currentState,
    keywordRankings,
    steps,
    keywordPriority: keywordRankings.map((kr, i) => ({
      rank: i + 1,
      keyword: kr.keyword,
      reason: kr.inLocalPack
        ? `In 3-Pack at ${kr.position} — defend and strengthen profile relevance.`
        : `${kr.position} — ${kr.gbpUpdates[0] ?? "Optimize GBP for this keyword."}`,
    })),
    weeklyCadence: [
      "5 new photos",
      "2 videos",
      "1 Google Post (rotate keywords outside 3-Pack)",
      "Respond to all new reviews",
      "Answer new Q&A questions",
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
