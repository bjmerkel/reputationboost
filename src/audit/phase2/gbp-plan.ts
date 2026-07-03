import type { GbpOptimizationPlan, GbpPlanStep, Phase1AuditPayload } from "../types";

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
  return keywords(audit).map((kw, i) => ({
    label: `Service #${i + 1}: ${kw}`,
    content: `Add "${kw}" as a named service with a 2-3 sentence description mentioning ${cityFromAddress(audit.gbp.identity.address)}, the specific use cases customers search for, and what makes ${audit.clientName} the trusted local choice.`,
  }));
}

export function buildTemplateGbpPlan(audit: Phase1AuditPayload): GbpOptimizationPlan {
  const targetKeywords = keywords(audit);
  const city = cityFromAddress(audit.gbp.identity.address);
  const category = audit.gbp.identity.primaryCategory;
  const reviewTarget = Math.max(200, audit.gbp.engagement.reviewCount + 50);
  const photoTarget = Math.max(200, audit.gbp.content.photoCount + 80);

  const steps: GbpPlanStep[] = [
    {
      stepNumber: 1,
      title: "Primary Category",
      instruction:
        "The primary category carries the most weight for Google Maps relevance. Choose the single category that best matches your core revenue service.",
      recommended: category,
      bullets: [
        `Keep "${category}" as primary unless audit data shows a better fit.`,
        "Do not switch categories frequently — stability signals trust.",
      ],
      gbpAction: "update_primary_category",
      actionData: { primaryCategory: category },
    },
    {
      stepNumber: 2,
      title: "Add Secondary Categories",
      instruction:
        "Add only categories that directly support your target keywords. Avoid irrelevant categories that dilute relevance.",
      bullets: [
        `${category} (Primary)`,
        "Airport Shuttle Service (if airport keywords apply)",
        "Transportation Service",
        "Chauffeur Service",
        "Car Service",
        "Add event-specific categories only if you actively offer them",
      ],
      gbpAction: "add_secondary_categories",
      actionData: {
        secondaryCategories: [
          "Airport Shuttle Service",
          "Transportation Service",
          "Chauffeur Service",
          "Car Service",
        ],
      },
    },
    {
      stepNumber: 3,
      title: "Rewrite the Business Description",
      instruction:
        "Google descriptions should weave in services, city names, and trust signals. Aim for 600-750 characters.",
      copyBlocks: [{ label: "Recommended description (paste into GBP)", content: descriptionDraft(audit) }],
      gbpAction: "update_description",
      actionData: { description: descriptionDraft(audit) },
    },
    {
      stepNumber: 4,
      title: "Complete Every Service Section",
      instruction:
        "Services are one of the most underutilized ranking factors. Create a dedicated GBP service entry for every target keyword plus high-intent variants.",
      copyBlocks: serviceSteps(audit),
      bullets: [
        "Add wedding, prom, corporate, airport, and event-specific service variants",
        "Each service needs its own description — do not duplicate text",
        `Complete all ${targetKeywords.length} core keyword services first`,
      ],
    },
    {
      stepNumber: 5,
      title: "Products Section",
      instruction:
        "Most local businesses ignore Products. Create one product per core keyword to reinforce relevance.",
      copyBlocks: targetKeywords.map((kw) => ({
        label: `Product: ${kw}`,
        content: `Create a product titled "${kw}" with a starting price, photo of your fleet or team, and a 2-sentence description focused on ${city} customers.`,
      })),
    },
    {
      stepNumber: 6,
      title: "Photo Optimization",
      instruction: `Google rewards active profiles. You currently have ${audit.gbp.content.photoCount} photos — target ${photoTarget}+.`,
      bullets: [
        "Exterior & storefront: 10 photos",
        "Interior / cabin shots: 10 photos",
        "Fleet & vehicles: 40+ photos (every vehicle type)",
        "Team & chauffeurs: 10 photos",
        "Customers (with permission): 20 photos",
        "Service-specific: airport pickups, weddings, proms, events — 20 each",
        "Upload 5+ new photos every week",
      ],
    },
    {
      stepNumber: 7,
      title: "Videos",
      instruction: "Upload 2-4 short videos weekly (30-60 seconds each).",
      bullets: [
        "Interior walkthrough / party bus lights",
        "Airport pickup arrival",
        "Wedding or prom arrival",
        "Fleet showcase",
        "Chauffeur opening doors / customer celebration",
      ],
    },
    {
      stepNumber: 8,
      title: "Weekly Google Posts",
      instruction:
        "Post every week. Rotate posts around your target keywords — include a photo, 150-300 words, and a call button.",
      bullets: targetKeywords.flatMap((kw, i) => [
        `Week ${i + 1}: ${kw}`,
        ...(i < targetKeywords.length - 1
          ? []
          : [`Week ${targetKeywords.length + 1}: ${targetKeywords[0]} — event variant`]),
      ]).slice(0, 8),
      gbpAction: "create_post",
      actionData: {
        postSummary: `Looking for ${targetKeywords[0]} in ${city}? ${audit.clientName} delivers professional ${category} with ${audit.gbp.engagement.reviewCount}+ reviews. Call ${audit.gbp.identity.phone} today.`,
      },
    },
    {
      stepNumber: 9,
      title: "Q&A Section",
      instruction:
        "Seed 15-25 questions from a personal Google account. Answer every question on your profile.",
      copyBlocks: targetKeywords.slice(0, 3).map((kw) => ({
        label: `Q: Do you provide ${kw.toLowerCase()}?`,
        content: `Yes, ${audit.clientName} offers ${kw.toLowerCase()} throughout ${city} and surrounding areas. Call ${audit.gbp.identity.phone} for availability.`,
      })),
      bullets: [
        "Add questions about 24/7 availability, service area, pricing, and airport service",
        `Answer all ${audit.gbp.content.unansweredQa} unanswered Q&As currently on your profile`,
      ],
    },
    {
      stepNumber: 10,
      title: "Reviews Strategy",
      instruction: `Reviews are one of the strongest ranking factors. Target ${reviewTarget}+ total reviews with keyword-rich natural language.`,
      bullets: [
        `Current: ${audit.gbp.engagement.reviewCount} reviews at ${audit.gbp.engagement.averageRating}★`,
        "Ask customers to mention which service they used — never script word-for-word",
        `Aim for ~30% of new reviews mentioning each target keyword theme`,
        ...targetKeywords.map((kw) => `Request reviews that naturally mention "${kw}"`),
      ],
    },
    {
      stepNumber: 11,
      title: "Review Responses",
      instruction:
        "Respond to every review within 24 hours. Mention the service and city naturally in your reply.",
      copyBlocks: [
        {
          label: "Response template",
          content: `Thank you for choosing ${audit.clientName} for your [SERVICE] in ${city}. We're glad our team provided reliable, professional service and appreciate your trust in us.`,
        },
      ],
      bullets: [
        `Current response rate: ${Math.round(audit.gbp.engagement.responseRate * 100)}% — target 100%`,
        `Respond to ${audit.reviews.unrespondedNegative} unresponded negative review(s) immediately`,
      ],
    },
    {
      stepNumber: 12,
      title: "Maintain Accurate Hours",
      instruction: "Inconsistent hours hurt rankings and customer trust.",
      bullets: [
        "Keep regular hours accurate — update for holidays",
        "Add special event hours when applicable",
        audit.gbp.completeness.hasHolidayHours
          ? "Holiday hours: configured ✓"
          : "Add holiday hours — currently missing",
      ],
    },
    {
      stepNumber: 13,
      title: "Attributes",
      instruction: "Enable every applicable attribute to strengthen relevance and trust.",
      bullets: [
        "Online appointments / booking",
        "Wheelchair accessibility (if applicable)",
        "Veteran-owned, women-owned, Latino-owned (if applicable)",
        "LGBTQ-friendly (if applicable)",
        `Currently ${audit.gbp.completeness.attributeCount} attributes — add all that apply`,
      ],
    },
    {
      stepNumber: 14,
      title: "Messaging",
      instruction: "Turn on GBP chat/messages and respond within minutes when possible.",
      bullets: [
        "Fast response rates increase engagement signals",
        "Set up mobile notifications for new messages",
      ],
    },
    {
      stepNumber: 15,
      title: "Booking Feature",
      instruction: "Enable online booking or appointment links if available.",
      bullets: [
        "Booking creates conversion signals directly inside Google",
        `Link to ${audit.gbp.identity.website || "your booking page"}`,
      ],
    },
    {
      stepNumber: 16,
      title: "Continuous Activity",
      instruction:
        "Google favors active profiles. Execute this cadence consistently for 6-12 months to compete for Top 3 positions.",
      bullets: [
        "Weekly: 5 new photos, 2 videos, 1 Google Post, respond to all reviews, answer new Q&As",
        "Monthly: add 3-5 services, add new products, upload event photos, refresh descriptions",
      ],
    },
  ];

  return {
    title: "Google Business Profile Optimization Report",
    businessName: audit.clientName,
    address: audit.gbp.identity.address,
    objective: `Rank ${audit.clientName} in the Google Maps Top 3 for all target keywords by maximizing relevance, prominence, and proximity through GBP optimization only.`,
    targetKeywords,
    steps,
    keywordPriority: targetKeywords.map((kw, i) => {
      const rank = audit.rankings.keywords.find((k) => k.keyword === kw);
      const reason = rank?.inLocalPack
        ? `Already in the 3-Pack at #${rank.localPackPosition} — defend and expand share.`
        : `Outside the 3-Pack — highest priority for GBP service, post, and review optimization.`;
      return { rank: i + 1, keyword: kw, reason };
    }),
    weeklyCadence: [
      "5 new photos",
      "2 videos",
      "1 Google Post (rotate target keywords)",
      "Respond to all new reviews",
      "Answer new Q&A questions",
    ],
    monthlyCadence: [
      "Add 3-5 new GBP services",
      "Add or update products",
      "Upload event-specific photo batches",
      "Refresh business description if offerings changed",
    ],
    contentSource: "template",
  };
}
