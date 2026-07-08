import type {
  ActionCategory,
  ActionPriority,
  GapFlag,
  KeywordRankSnapshot,
  Phase1AuditPayload,
} from "../types";
import type { OutcomesContext } from "../outcomes/types";
import { SEARCH_RADII_MILES } from "@/lib/google/places";
import { detectPackFragility, resolveKeywordPositionAtRadius } from "./scoring";
import { resolveKeywordRelevance } from "./relevance-heuristic";
import { gapScoreComponent, gapScoreImpact } from "./score-impact";
import { napDriftGapId } from "@/lib/google/nap-drift";

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function impactScore(impact: number, effort: number) {
  return impact * (11 - effort);
}

function formatRadiusRankSummary(kw: KeywordRankSnapshot): string {
  return SEARCH_RADII_MILES.map((miles) => {
    const rank = resolveKeywordPositionAtRadius(kw, miles);
    const label = rank === "not_in_pack" ? "outside pack" : `#${rank}`;
    return `${miles} mi: ${label}`;
  }).join(" · ");
}

function gap(
  id: string,
  priority: ActionPriority,
  category: ActionCategory,
  title: string,
  description: string,
  impact: number,
  effort: number
): GapFlag {
  const flag: GapFlag = {
    id,
    priority,
    category,
    title,
    description,
    impact,
    effort,
    impactScore: impactScore(impact, effort),
  };
  flag.scoreComponent = gapScoreComponent(flag);
  flag.scoreImpact = gapScoreImpact(flag);
  return flag;
}

function applyOutcomeGapAdjustments(gaps: GapFlag[], outcomes: OutcomesContext): void {
  const postWins = outcomes.provenWins.filter((w) => w.taskType === "google_post");
  if (postWins.length > 0) {
    const stale = gaps.find((g) => g.id === "stale-posts");
    if (stale) {
      stale.priority = "P3";
      stale.impact = 4;
      stale.description +=
        " Recent posts already drove measurable gains — maintain cadence rather than urgent catch-up.";
    }
  }

  const reviewWins = outcomes.provenWins.filter((w) => w.taskType === "review_response");
  if (reviewWins.length > 0) {
    const unresponded = gaps.find((g) => g.id === "unresponded-negative");
    if (unresponded) {
      unresponded.impact = Math.min(10, unresponded.impact + 1);
      unresponded.description +=
        " Prior review replies correlated with engagement lifts — speed matters.";
    }
  }

  if (outcomes.tasksSkipped >= 2) {
    gaps.unshift(
      gap(
        "incomplete-prior-actions",
        "P1",
        "content",
        `${outcomes.tasksSkipped} actions still awaiting completion`,
        "Finish pending items from your last plan before adding new work — incomplete posts and profile updates leave rankings on the table.",
        8,
        3
      )
    );
  }

  for (const g of gaps) {
    g.impactScore = impactScore(g.impact, g.effort);
    g.scoreComponent = gapScoreComponent(g);
    g.scoreImpact = gapScoreImpact(g);
  }
}

export function detectGaps(
  audit: Phase1AuditPayload,
  outcomes?: OutcomesContext | null
): GapFlag[] {
  const gaps: GapFlag[] = [];

  for (const kw of audit.rankings.keywords.filter((k) => !k.inLocalPack)) {
    gaps.push(
      gap(
        `rank-outside-pack-${kw.keyword}`,
        "P0",
        "rankings",
        `Not in Local 3-Pack: "${kw.keyword}"`,
        `You are missing 70%+ of map clicks for this keyword. Position: ${kw.localPackPosition}. Pack leader has ${kw.packLeaderReviewCount} reviews.`,
        10,
        6
      )
    );
  }

  for (const kw of audit.rankings.keywords) {
    const fragility = detectPackFragility(kw);
    if (!fragility.fragile || fragility.weakestRadiusMiles == null) continue;

    gaps.push(
      gap(
        `pack-fragility-${kw.keyword}`,
        "P1",
        "rankings",
        `Pack fragile on "${kw.keyword}"`,
        `You rank in the Local 3-Pack within 1 mi but drop off by ${fragility.weakestRadiusMiles} mi (${formatRadiusRankSummary(kw)}). Customers searching farther out see competitors first — strengthen posts and reviews for this keyword.`,
        8,
        5
      )
    );
  }

  for (const rel of resolveKeywordRelevance(audit).filter((r) => r.score < 50)) {
    const priority: ActionPriority = rel.score < 30 ? "P0" : "P1";
    const gapText =
      rel.recommendation ??
      `Profile weakly matches "${rel.keyword}" — strengthen category, services, and review corpus alignment.`;
    const competitorNote =
      rel.competitorGaps.length > 0 ? ` ${rel.competitorGaps[0]}` : "";

    gaps.push(
      gap(
        `relevance-gap-${rel.keyword}`,
        priority,
        "gbp_profile",
        `Weak relevance for "${rel.keyword}" (${rel.score}/100)`,
        `${gapText}${competitorNote}`,
        rel.score < 30 ? 9 : 7,
        4
      )
    );
  }

  for (const kw of audit.rankings.keywords.filter((k) => k.inLocalPack)) {
    if (kw.clientReviewCount < kw.packLeaderReviewCount * 0.5) {
      gaps.push(
        gap(
          `review-gap-${kw.keyword}`,
          "P1",
          "reviews",
          `Review gap on "${kw.keyword}"`,
          `You have ${kw.clientReviewCount} reviews vs. pack leader's ${kw.packLeaderReviewCount}. Strong social proof can shift clicks from #1 to your listing.`,
          8,
          4
        )
      );
    }
  }

  const daysSincePost = daysSince(audit.gbp.content.lastPostDate);
  const localPostCoverage = audit.gbp.localPosts;
  if (localPostCoverage && !localPostCoverage.apiAvailable) {
    gaps.push(
      gap(
        "local-posts-api-unavailable",
        "P2",
        "technical",
        "Local Posts API unavailable",
        "Google Posts can't be loaded. Reconnect with a manager account.",
        4,
        2
      )
    );
  } else if (localPostCoverage?.rejectedPostCount) {
    gaps.push(
      gap(
        "rejected-local-posts",
        "P2",
        "content",
        "Rejected Google Posts",
        `${localPostCoverage.rejectedPostCount} post${localPostCoverage.rejectedPostCount === 1 ? "" : "s"} rejected by Google — review content policies and republish.`,
        5,
        2
      )
    );
  } else if (daysSincePost > 14) {
    gaps.push(
      gap(
        "stale-posts",
        "P2",
        "content",
        "No recent Google Posts",
        `Last post was ${daysSincePost} days ago. Active posting signals relevance to Google Maps.`,
        6,
        3
      )
    );
  }

  if (
    localPostCoverage?.apiAvailable &&
    localPostCoverage.livePostCount > 0 &&
    !localPostCoverage.hasCallToActionPosts &&
    !localPostCoverage.hasOfferPost
  ) {
    gaps.push(
      gap(
        "posts-without-cta",
        "P3",
        "content",
        "Posts missing call-to-action",
        "Your Google Posts don't include Book, Learn more, or Call buttons — add CTAs to drive clicks.",
        3,
        2
      )
    );
  }

  if (audit.gbp.content.photoCount < 20) {
    gaps.push(
      gap(
        "low-photos",
        "P2",
        "gbp_profile",
        "Insufficient GBP photos",
        `Only ${audit.gbp.content.photoCount} photos. Top competitors average 60+. Add project, team, and service photos.`,
        5,
        3
      )
    );
  }

  const mediaCoverage = audit.gbp.content.mediaCoverage;
  if (mediaCoverage) {
    for (const category of mediaCoverage.missingCategories) {
      gaps.push(
        gap(
          `missing-media-${category.toLowerCase()}`,
          "P2",
          "gbp_profile",
          `Missing ${category.toLowerCase().replace(/_/g, " ")} photos`,
          `Your profile is missing ${category.toLowerCase().replace(/_/g, " ")} photos. Google uses category variety to judge listing quality.`,
          5,
          2
        )
      );
    }

    if (!mediaCoverage.hasVideo) {
      gaps.push(
        gap(
          "missing-video",
          "P2",
          "gbp_profile",
          "No GBP videos",
          "Add at least one short video showing your team, workspace, or service in action.",
          4,
          2
        )
      );
    }

    if (
      mediaCoverage.daysSinceLastUpload !== null &&
      mediaCoverage.daysSinceLastUpload > 90 &&
      audit.gbp.content.photoCount > 0
    ) {
      gaps.push(
        gap(
          "stale-media",
          "P3",
          "gbp_profile",
          "Photos are getting stale",
          `Your newest Google photo is ${mediaCoverage.daysSinceLastUpload} days old. Fresh media signals an active business.`,
          3,
          2
        )
      );
    }

    const additionalCount = audit.gbp.content.photosByType.ADDITIONAL ?? 0;
    if (
      additionalCount >= 6 &&
      mediaCoverage.missingCategories.length > 0 &&
      additionalCount / Math.max(audit.gbp.content.photoCount, 1) >= 0.4
    ) {
      gaps.push(
        gap(
          "miscategorized-media",
          "P2",
          "gbp_profile",
          "Too many uncategorized photos",
          `${additionalCount} photos are in Additional while key categories are missing. Recategorize or replace them.`,
          4,
          2
        )
      );
    }

    if (
      mediaCoverage.ownerPhotoCount >= 10 &&
      mediaCoverage.engagementScore < 40
    ) {
      gaps.push(
        gap(
          "low-media-engagement",
          "P2",
          "gbp_profile",
          "Low photo engagement",
          `Your owner photos average ${mediaCoverage.ownerAvgViews} views each (${mediaCoverage.ownerTotalViews.toLocaleString()} total). Upload higher-quality, categorized photos that showcase your work.`,
          4,
          2
        )
      );
    }

    if (
      mediaCoverage.customerPhotoShare >= 55 &&
      mediaCoverage.ownerPhotoCount < 15
    ) {
      gaps.push(
        gap(
          "customer-photos-dominate",
          "P2",
          "gbp_profile",
          "Customer photos outnumber yours",
          `${mediaCoverage.customerPhotoCount} customer photos vs ${mediaCoverage.ownerPhotoCount} owner photos. Add branded project and team photos so you control the first impression.`,
          4,
          2
        )
      );
    }

    if (
      mediaCoverage.ownerZeroViewCount >= 5 &&
      mediaCoverage.ownerPhotoCount >= 10
    ) {
      gaps.push(
        gap(
          "zero-view-owner-photos",
          "P3",
          "gbp_profile",
          "Many photos get zero views",
          `${mediaCoverage.ownerZeroViewCount} owner photos have never been viewed. Replace low performers with fresh, categorized media.`,
          3,
          2
        )
      );
    }
  }

  if (!audit.gbp.completeness.hasHolidayHours) {
    gaps.push(
      gap(
        "missing-holiday-hours",
        "P2",
        "gbp_profile",
        "Missing holiday hours",
        "Add holiday hours to avoid customer frustration and improve trust signals.",
        5,
        2
      )
    );
  }

  if (!audit.gbp.completeness.hasFullWeekHours && audit.gbp.completeness.hasHours) {
    gaps.push(
      gap(
        "incomplete-week-hours",
        "P2",
        "gbp_profile",
        "Incomplete weekly hours",
        "Your profile is missing open days in regular business hours. Full weekly coverage improves completeness and trust.",
        5,
        2
      )
    );
  }

  if (!audit.gbp.completeness.noPendingEdits) {
    const processingFields =
      audit.gbp.googleUpdateState?.pendingFields.map((f) => f.label).join(", ") ?? "";
    gaps.push(
      gap(
        "google-pending-edits",
        "P1",
        "gbp_profile",
        "Google has pending edits on your profile",
        processingFields
          ? `Your updates are still processing for: ${processingFields}. Other suggested changes may also need review in Business Profile Manager.`
          : "Review and accept or reject Google's suggested changes before they affect how customers see your business.",
        8,
        2
      )
    );
  }

  const diffSuggestions =
    audit.gbp.googleSuggestions?.filter((s) => s.kind !== "pending") ??
    audit.gbp.googleUpdateState?.diffFields ??
    [];
  if (diffSuggestions.length > 0) {
    const fields = diffSuggestions.map((s) => s.label).join(", ");
    gaps.push(
      gap(
        "google-suggested-edits",
        "P1",
        "gbp_profile",
        "Google suggested profile changes",
        `Google recommends updates to: ${fields}. Review each suggestion in Take Action.`,
        7,
        2
      )
    );
  }

  for (const drift of audit.gbp.napDrift ?? []) {
    gaps.push(
      gap(
        napDriftGapId(drift.field as "title" | "phone" | "website" | "address"),
        "P1",
        "gbp_profile",
        `NAP mismatch: ${drift.label}`,
        `Your onboarding record says "${drift.canonical}" but Google shows "${drift.live}". Sync to keep trust signals consistent.`,
        7,
        2
      )
    );
  }

  const attributeCoverage = audit.gbp.attributeCoverage;
  if (attributeCoverage && attributeCoverage.availableCount > 0 && attributeCoverage.missingCount > 0) {
    gaps.push(
      gap(
        "low-attributes",
        "P2",
        "gbp_profile",
        "Business attributes incomplete",
        `Missing ${attributeCoverage.missingCount} of ${attributeCoverage.availableCount} available attributes (e.g. ${attributeCoverage.missing
          .slice(0, 2)
          .map((item) => item.displayName)
          .join(", ")}). Enable them to strengthen profile completeness and your Reputation Boost Score.`,
        6,
        2
      )
    );
  } else if (audit.gbp.completeness.attributeCount < 5) {
    gaps.push(
      gap(
        "low-attributes",
        "P2",
        "gbp_profile",
        "Few business attributes enabled",
        `Only ${audit.gbp.completeness.attributeCount} attributes on your profile. Enable at least 5 to strengthen relevance and completeness.`,
        6,
        2
      )
    );
  }

  if (!audit.gbp.completeness.hasHours) {
    gaps.push(
      gap(
        "missing-hours",
        "P1",
        "gbp_profile",
        "Missing business hours",
        "Add regular business hours so customers know when you're open.",
        7,
        2
      )
    );
  }

  const reviewCoverage = audit.reviews.coverage ?? audit.gbp.reviewCoverage;
  if (reviewCoverage && !reviewCoverage.apiAvailable) {
    gaps.push(
      gap(
        "reviews-api-unavailable",
        "P2",
        "technical",
        "Reviews API unavailable",
        "Google reviews can't be loaded. Reconnect with a manager account.",
        4,
        2
      )
    );
  } else if (audit.reviews.rejectedReplies > 0) {
    gaps.push(
      gap(
        "rejected-review-replies",
        "P2",
        "reviews",
        "Rejected review replies",
        `${audit.reviews.rejectedReplies} review repl${audit.reviews.rejectedReplies === 1 ? "y was" : "ies were"} rejected by Google — revise and repost.`,
        5,
        2
      )
    );
  } else if (audit.reviews.pendingReplies > 0) {
    gaps.push(
      gap(
        "pending-review-replies",
        "P3",
        "reviews",
        "Pending review replies",
        `${audit.reviews.pendingReplies} repl${audit.reviews.pendingReplies === 1 ? "y is" : "ies are"} awaiting Google moderation.`,
        3,
        1
      )
    );
  }

  if (audit.reviews.unrespondedNegative > 0) {
    gaps.push(
      gap(
        "unresponded-negative",
        "P0",
        "reviews",
        `${audit.reviews.unrespondedNegative} unresponded negative review(s)`,
        "Unanswered negative reviews hurt conversion. Respond within 24 hours with empathy and a resolution path.",
        9,
        2
      )
    );
  }

  if (audit.gbp.engagement.responseRate < 0.85) {
    gaps.push(
      gap(
        "low-response-rate",
        "P1",
        "reviews",
        "Review response rate below 85%",
        `Current response rate: ${Math.round(audit.gbp.engagement.responseRate * 100)}%. Google rewards engaged businesses.`,
        7,
        2
      )
    );
  }

  const notifications = audit.gbp.notifications;
  if (notifications && !notifications.configured) {
    gaps.push(
      gap(
        "missing-pubsub-notifications",
        "P2",
        "technical",
        "No real-time GBP alerts configured",
        "Enable Pub/Sub notifications for new reviews, Google edits, customer media, and listing status changes.",
        4,
        2
      )
    );
  } else if (
    notifications?.configured &&
    notifications.missingRecommendedTypes.length > 0
  ) {
    gaps.push(
      gap(
        "incomplete-notification-types",
        "P3",
        "technical",
        "Incomplete GBP alert subscriptions",
        `Missing alert types: ${notifications.missingRecommendedTypes
          .map((t) => t.replace(/_/g, " ").toLowerCase())
          .join(", ")}.`,
        3,
        1
      )
    );
  }

  const perfCoverage = audit.gbp.performance.coverage;
  if (perfCoverage && !perfCoverage.apiAvailable) {
    gaps.push(
      gap(
        "performance-api-unavailable",
        "P1",
        "technical",
        "Performance API unavailable",
        audit.gbp.performance.error ??
          "Google Performance API metrics aren't loading. Reconnect with a manager account.",
        6,
        2
      )
    );
  } else if (perfCoverage?.partialApi) {
    gaps.push(
      gap(
        "partial-performance-api",
        "P2",
        "technical",
        "Partial Performance API data",
        (audit.gbp.performance.warnings ?? []).join(" ") ||
          "Some performance endpoints returned partial data.",
        4,
        2
      )
    );
  }

  if (
    perfCoverage?.apiAvailable &&
    !perfCoverage.hasSearchKeywords &&
    audit.rankings.keywords.length > 0
  ) {
    gaps.push(
      gap(
        "no-search-keyword-data",
        "P2",
        "rankings",
        "No search keyword impressions",
        "Google isn't reporting search terms for your listing. Strengthen categories, posts, and relevance signals.",
        4,
        2
      )
    );
  }

  if (
    perfCoverage?.apiAvailable &&
    perfCoverage.hasImpressionMetrics &&
    perfCoverage.totalActions === 0 &&
    audit.gbp.performance.profileViews >= 100
  ) {
    gaps.push(
      gap(
        "low-profile-conversions",
        "P2",
        "gbp_profile",
        "Views without actions",
        `${audit.gbp.performance.profileViews} profile views but no calls, directions, or website clicks in ${audit.gbp.performance.periodDays} days.`,
        5,
        2
      )
    );
  }

  const placeActions = audit.gbp.placeActions;
  if (placeActions && !placeActions.apiAvailable) {
    gaps.push(
      gap(
        "place-actions-api-unavailable",
        "P2",
        "technical",
        "Place Actions API unavailable",
        "Booking and ordering links can't be loaded. Reconnect with a manager account.",
        4,
        2
      )
    );
  } else if (placeActions?.apiAvailable && placeActions.configuredTypes.length === 0) {
    gaps.push(
      gap(
        "missing-place-action-links",
        "P2",
        "gbp_profile",
        "No place action links configured",
        "Add booking, ordering, or shop links so customers can act directly from Google Maps.",
        5,
        2
      )
    );
  } else if (
    placeActions?.apiAvailable &&
    placeActions.missingRecommendedTypes.length > 0
  ) {
    gaps.push(
      gap(
        "incomplete-place-action-links",
        "P2",
        "gbp_profile",
        "Incomplete place action links",
        `Missing: ${placeActions.missingRecommendedTypes
          .map((t) => t.replace(/_/g, " ").toLowerCase())
          .join(", ")}.`,
        4,
        2
      )
    );
  }

  if (!audit.offGoogle.website.hasLocalBusinessSchema) {
    gaps.push(
      gap(
        "missing-schema",
        "P2",
        "technical",
        "Missing LocalBusiness schema",
        "Add structured data to your website to reinforce NAP and local relevance.",
        5,
        4
      )
    );
  }

  if (audit.offGoogle.socialPostCountLast30Days < 4) {
    gaps.push(
      gap(
        "low-social",
        "P3",
        "social",
        "Low social media activity",
        "Increase Facebook/Instagram posts to amplify GBP content and brand visibility.",
        4,
        4
      )
    );
  }

  const topCompetitor = audit.competitors[0]?.competitors[0];
  if (topCompetitor && topCompetitor.postsLast30Days > 4) {
    gaps.push(
      gap(
        "competitor-post-frequency",
        "P1",
        "content",
        "Competitors post more frequently",
        `${topCompetitor.name} posted ${topCompetitor.postsLast30Days}x this month. Match or exceed their cadence.`,
        7,
        4
      )
    );
  }

  if (outcomes) {
    applyOutcomeGapAdjustments(gaps, outcomes);
  }

  return gaps.sort((a, b) => b.impactScore - a.impactScore);
}
