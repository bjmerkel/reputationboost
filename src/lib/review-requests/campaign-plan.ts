import type { FullAuditPayload, KeywordRankAnalysis } from "@/audit/types";
import type { CustomerRecord } from "@/lib/customers/types";
import { estimateStepHealthImpact } from "@/audit/phase2/score-impact";

export interface ReviewKeywordTarget {
  keyword: string;
  clientReviews: number;
  packLeaderReviews: number;
  reviewGap: number;
  /** New reviews to request this month for this keyword */
  reviewsNeeded: number;
  priority: "high" | "medium";
  recommendation: string;
}

export interface ReviewCampaignPlan {
  currentReviewCount: number;
  averageRating: number;
  /** Primary keyword to focus this batch on */
  focusKeyword: string | null;
  /** Total new reviews to aim for this month */
  monthlyReviewTarget: number;
  /** Suggested SMS batch size for this send */
  batchSize: number;
  keywordTargets: ReviewKeywordTarget[];
  executionSteps: string[];
  expectedEffect: string;
  projectedScoreImpact: number | null;
}

function significantTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["near", "best", "local"].includes(w));
}

export function customerMatchesKeyword(
  customer: Pick<CustomerRecord, "service_notes">,
  keyword: string
): boolean {
  const notes = customer.service_notes?.trim().toLowerCase() ?? "";
  if (!notes) return false;

  const tokens = significantTokens(keyword);
  if (tokens.length === 0) return notes.includes(keyword.toLowerCase());
  return tokens.some((t) => notes.includes(t));
}

function reviewsNeededForKeyword(row: KeywordRankAnalysis): number {
  if (row.reviewGap <= 0) {
    return row.inLocalPack ? 0 : 5;
  }

  const closeGapTarget = Math.ceil(row.reviewGap * 0.3);
  const minimum = row.inLocalPack ? 5 : 8;
  return Math.min(Math.max(minimum, closeGapTarget), 20);
}

function priorityForKeyword(row: KeywordRankAnalysis): "high" | "medium" {
  if (!row.inLocalPack || row.packFragile) return "high";
  if (row.reviewGap > 20) return "high";
  return "medium";
}

function recommendationForKeyword(row: KeywordRankAnalysis, needed: number): string {
  if (needed <= 0) {
    return `Maintain review momentum for "${row.keyword}"`;
  }

  if (!row.inLocalPack) {
    return `Increase review count to at least ${needed} for "${row.keyword}" — request reviews from customers who used this program or service`;
  }

  if (row.reviewGap > 20) {
    return `Close the ${row.reviewGap}-review gap on "${row.keyword}" (${row.clientReviews} vs leader's ${row.packLeaderReviews}) — target ${needed} new reviews mentioning this service`;
  }

  return `Request ${needed} review${needed === 1 ? "" : "s"} from recent "${row.keyword}" customers`;
}

function rankKeywordTargets(rankings: KeywordRankAnalysis[]): ReviewKeywordTarget[] {
  return rankings
    .map((row) => {
      const reviewsNeeded = reviewsNeededForKeyword(row);
      return {
        keyword: row.keyword,
        clientReviews: row.clientReviews,
        packLeaderReviews: row.packLeaderReviews,
        reviewGap: row.reviewGap,
        reviewsNeeded,
        priority: priorityForKeyword(row),
        recommendation: recommendationForKeyword(row, reviewsNeeded),
      };
    })
    .filter((t) => t.reviewsNeeded > 0)
    .sort((a, b) => {
      const priorityWeight = (p: ReviewKeywordTarget["priority"]) => (p === "high" ? 2 : 1);
      const scoreA = priorityWeight(a.priority) * 1000 + a.reviewGap;
      const scoreB = priorityWeight(b.priority) * 1000 + b.reviewGap;
      return scoreB - scoreA;
    });
}

function buildExecutionSteps(
  focusKeyword: string | null,
  batchSize: number,
  matchedCustomers: number,
  eligibleCount: number
): string[] {
  const steps: string[] = [];

  if (focusKeyword) {
    steps.push(
      `Prioritize customers who used "${focusKeyword}" — set the Service field when importing or adding customers`
    );
    if (matchedCustomers > 0) {
      steps.push(
        `Send this batch of ${batchSize} to the ${matchedCustomers} eligible customer${matchedCustomers === 1 ? "" : "s"} matched to "${focusKeyword}" first`
      );
    } else {
      steps.push(
        `No customers are tagged for "${focusKeyword}" yet — import recent customers and set Service to match this keyword before sending`
      );
    }
  }

  steps.push(
    `Use the SMS below — [SERVICE] personalizes per customer and nudges keyword-rich reviews without sounding scripted`
  );
  steps.push(
    `Send ${batchSize} requests now, then repeat weekly until monthly targets are met (${eligibleCount} eligible total)`
  );
  steps.push("Respond to every new review within 24 hours and mention the service naturally in your reply");

  return steps;
}

export interface BuildReviewCampaignPlanOptions {
  eligibleCount?: number;
  matchedToFocusKeyword?: number;
  focusKeywordOverride?: string | null;
}

export function buildReviewCampaignPlan(
  audit: FullAuditPayload,
  options: BuildReviewCampaignPlanOptions = {}
): ReviewCampaignPlan {
  const rankings = audit.strategy.gbpPlan?.keywordRankings ?? [];
  const keywordTargets = rankKeywordTargets(rankings);
  const focusKeyword =
    options.focusKeywordOverride ??
    keywordTargets.find((t) => t.priority === "high")?.keyword ??
    keywordTargets[0]?.keyword ??
    audit.strategy.gbpPlan?.targetKeywords?.[0] ??
    audit.rankings.keywords[0]?.keyword ??
    null;

  const monthlyReviewTarget = Math.min(
    30,
    keywordTargets.slice(0, 4).reduce((sum, t) => sum + t.reviewsNeeded, 0) || 8
  );

  const eligibleCount = options.eligibleCount ?? 0;
  const suggestedBatch = Math.min(
    Math.max(10, Math.ceil(monthlyReviewTarget / 2)),
    eligibleCount > 0 ? eligibleCount : 15
  );
  const batchSize = Math.min(25, Math.max(5, suggestedBatch));

  const matchedCustomers = options.matchedToFocusKeyword ?? 0;

  const gaps = rankings.filter((r) => r.reviewGap > 20);
  const expectedEffect =
    gaps.length > 0 && focusKeyword
      ? `Close review-count gaps on "${focusKeyword}" (${gaps.find((g) => g.keyword === focusKeyword)?.reviewGap ?? gaps[0].reviewGap} behind the pack leader) to lift your Reputation Boost Score`
      : focusKeyword
        ? `Grow review volume with keyword-rich reviews for "${focusKeyword}"`
        : "Grow review volume with keyword-rich natural language from customers";

  let projectedScoreImpact: number | null = null;
  try {
    projectedScoreImpact = estimateStepHealthImpact(audit, 10);
  } catch {
    projectedScoreImpact = null;
  }

  return {
    currentReviewCount: audit.gbp.engagement.reviewCount,
    averageRating: audit.gbp.engagement.averageRating,
    focusKeyword,
    monthlyReviewTarget,
    batchSize,
    keywordTargets: keywordTargets.slice(0, 6),
    executionSteps: buildExecutionSteps(focusKeyword, batchSize, matchedCustomers, eligibleCount),
    expectedEffect,
    projectedScoreImpact,
  };
}

export function countCustomersMatchingKeyword(
  customers: Pick<CustomerRecord, "service_notes">[],
  keyword: string | null
): number {
  if (!keyword) return 0;
  return customers.filter((c) => customerMatchesKeyword(c, keyword)).length;
}
