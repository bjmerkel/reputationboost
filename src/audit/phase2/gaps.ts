import type {
  ActionCategory,
  ActionPriority,
  GapFlag,
  Phase1AuditPayload,
} from "../types";
import type { OutcomesContext } from "../outcomes/types";
import { gapScoreComponent, gapScoreImpact } from "./score-impact";

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function impactScore(impact: number, effort: number) {
  return impact * (11 - effort);
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
  if (daysSincePost > 14) {
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

  if (!audit.gbp.completeness.hasHolidayHours) {
    gaps.push(
      gap(
        "missing-holiday-hours",
        "P3",
        "gbp_profile",
        "Missing holiday hours",
        "Add holiday hours to avoid customer frustration and improve trust signals.",
        3,
        2
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

  if (audit.gbp.content.unansweredQa > 0) {
    gaps.push(
      gap(
        "unanswered-qa",
        "P2",
        "gbp_profile",
        `${audit.gbp.content.unansweredQa} unanswered Q&A`,
        "Answer customer questions on your GBP — they appear in search results.",
        5,
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

  if (audit.offGoogle.citationConsistencyScore < 80) {
    gaps.push(
      gap(
        "citation-mismatch",
        "P2",
        "technical",
        "Citation NAP inconsistencies",
        `Citation consistency score: ${audit.offGoogle.citationConsistencyScore}%. Fix mismatches on Apple Maps, Facebook, and directories.`,
        6,
        5
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
