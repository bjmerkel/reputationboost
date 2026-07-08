import {
  significantKeywordTokens,
  textContainsKeyword,
} from "@/audit/attribution/keywords";
import type { FullAuditPayload, ReviewRecord } from "@/audit/types";
import type { CustomerKeywordHint } from "./customer-match";
import {
  customerServiceMatchesKeyword,
  customerServiceNotesForReviewer,
} from "./customer-match";

export type ReviewKeywordWeaveReason =
  | "review_mentions_service"
  | "customer_service_match"
  | "outside_pack_gap"
  | "low_review_mentions"
  | "batch_rotation"
  | "active_campaign"
  | null;

export interface ReviewResponseKeywordOptions {
  /** Keywords from active review_keyword_campaigns — boosts scoring +15 each. */
  activeCampaignKeywords?: string[];
  /** Customers with service notes — match reviewer names for keyword opportunities. */
  customers?: CustomerKeywordHint[];
}

export interface ReviewResponseKeywordContext {
  suggestedKeyword: string | null;
  reason: ReviewKeywordWeaveReason;
  weaveHints: string[];
  serviceTokens: string[];
  areaToken: string | null;
  skipReason: ReviewKeywordSkipReason;
  /** Set when this opportunity aligns with an active SMS review campaign. */
  activeCampaignKeyword?: string | null;
}

export type ReviewKeywordSkipReason =
  | "negative_review"
  | "already_covered"
  | "no_natural_hook"
  | null;

const SCORE_THRESHOLD = 50;
const ROTATION_SCORE_THRESHOLD = 35;

function trackedKeywords(audit: FullAuditPayload): string[] {
  const fromPlan = audit.strategy.gbpPlan?.targetKeywords ?? [];
  if (fromPlan.length > 0) return fromPlan;
  return audit.rankings.keywords.map((k) => k.keyword);
}

export function extractAreaToken(address: string): string | null {
  const city = address.split(",")[1]?.trim();
  return city && city.length > 0 ? city : null;
}

export function extractServiceTokens(keyword: string): string[] {
  const tokens = significantKeywordTokens(keyword);
  if (tokens.length > 0) return tokens;
  const trimmed = keyword.trim();
  return trimmed.length > 0 ? [trimmed.toLowerCase()] : [];
}

function reviewMentionsCount(audit: FullAuditPayload, keyword: string): number {
  const cached = audit.keywordRelevance?.find(
    (row) => row.keyword.toLowerCase() === keyword.toLowerCase()
  );
  if (cached != null) return cached.reviewMentions;

  const tokens = significantKeywordTokens(keyword);
  if (tokens.length === 0) return 0;

  return audit.reviews.reviews.filter((review) => {
    const lower = review.text.toLowerCase();
    return tokens.some((token) => lower.includes(token));
  }).length;
}

function isOutsidePack(audit: FullAuditPayload, keyword: string): boolean {
  const fromPlan = audit.strategy.gbpPlan?.keywordRankings?.find(
    (row) => row.keyword.toLowerCase() === keyword.toLowerCase()
  );
  if (fromPlan) return !fromPlan.inLocalPack;

  const fromRankings = audit.rankings.keywords.find(
    (row) => row.keyword.toLowerCase() === keyword.toLowerCase()
  );
  return fromRankings ? !fromRankings.inLocalPack : false;
}

function matchingTokensInText(text: string, keyword: string): string[] {
  const tokens = significantKeywordTokens(keyword);
  const lower = text.toLowerCase();
  return tokens.filter((token) => lower.includes(token));
}

function isActiveCampaignKeyword(keyword: string, options?: ReviewResponseKeywordOptions): boolean {
  const campaigns = options?.activeCampaignKeywords ?? [];
  return campaigns.some((row) => row.toLowerCase() === keyword.toLowerCase());
}

function scoreKeywordForReview(
  audit: FullAuditPayload,
  review: ReviewRecord,
  keyword: string,
  options?: ReviewResponseKeywordOptions
): { score: number; reason: ReviewKeywordWeaveReason } {
  if (review.rating <= 2) {
    return { score: -100, reason: null };
  }

  let score = 0;
  let reason: ReviewKeywordWeaveReason = null;
  const reviewText = review.text ?? "";

  if (textContainsKeyword(reviewText, keyword)) {
    score += 40;
    reason = "review_mentions_service";
  }

  if (customerServiceMatchesKeyword(review.author, keyword, options?.customers ?? [])) {
    score += 35;
    if (!reason) reason = "customer_service_match";
  }

  if (isOutsidePack(audit, keyword)) {
    score += 25;
    if (!reason) reason = "outside_pack_gap";
  }

  if (reviewMentionsCount(audit, keyword) < 2) {
    score += 20;
    if (!reason) reason = "low_review_mentions";
  }

  if (isActiveCampaignKeyword(keyword, options)) {
    score += 15;
    if (!reason) reason = "active_campaign";
  }

  return { score, reason };
}

function buildWeaveHints(
  audit: FullAuditPayload,
  review: ReviewRecord,
  keyword: string,
  options?: ReviewResponseKeywordOptions
): string[] {
  const hints: string[] = [];
  const reviewText = review.text ?? "";
  const matched = matchingTokensInText(reviewText, keyword);

  if (matched.length > 0) {
    hints.push(`customer mentioned "${matched.join(", ")}"`);
  }

  const serviceNotes = customerServiceNotesForReviewer(review.author, options?.customers ?? []);
  if (serviceNotes) {
    hints.push(`customer record notes: "${serviceNotes}"`);
  }

  const area = extractAreaToken(audit.gbp.identity.address);
  if (area) {
    hints.push(`business serves ${area}`);
  }

  const tokens = extractServiceTokens(keyword);
  if (tokens.length > 0 && matched.length === 0) {
    hints.push(`service term: "${tokens[0]}"`);
  }

  return hints;
}

function emptyContext(
  audit: FullAuditPayload,
  review: ReviewRecord,
  skipReason: ReviewKeywordSkipReason = "no_natural_hook"
): ReviewResponseKeywordContext {
  return {
    suggestedKeyword: null,
    reason: null,
    weaveHints: [],
    serviceTokens: [],
    areaToken: extractAreaToken(audit.gbp.identity.address),
    skipReason,
  };
}

function buildContextForKeyword(
  audit: FullAuditPayload,
  review: ReviewRecord,
  keyword: string,
  reason: ReviewKeywordWeaveReason,
  options?: ReviewResponseKeywordOptions
): ReviewResponseKeywordContext {
  const hints = buildWeaveHints(audit, review, keyword, options);
  if (isActiveCampaignKeyword(keyword, options)) {
    hints.push("active SMS review campaign is collecting mentions for this service");
  }

  return {
    suggestedKeyword: keyword,
    reason,
    weaveHints: hints,
    serviceTokens: extractServiceTokens(keyword),
    areaToken: extractAreaToken(audit.gbp.identity.address),
    skipReason: null,
    activeCampaignKeyword: isActiveCampaignKeyword(keyword, options) ? keyword : null,
  };
}

/** Build keyword context when the user explicitly requests a weave attempt. */
export function buildForcedKeywordContext(
  audit: FullAuditPayload,
  review: ReviewRecord,
  keyword: string,
  options?: ReviewResponseKeywordOptions
): ReviewResponseKeywordContext {
  if (review.rating <= 2) {
    return emptyContext(audit, review, "negative_review");
  }

  const reason: ReviewKeywordWeaveReason = isActiveCampaignKeyword(keyword, options)
    ? "active_campaign"
    : "batch_rotation";

  return buildContextForKeyword(audit, review, keyword, reason, options);
}

/** Pick the best optional keyword opportunity for a single review. */
export function resolveReviewResponseKeywordContext(
  audit: FullAuditPayload,
  review: ReviewRecord,
  options?: ReviewResponseKeywordOptions
): ReviewResponseKeywordContext {
  if (review.rating <= 2) {
    return emptyContext(audit, review, "negative_review");
  }

  const keywords = trackedKeywords(audit);
  if (keywords.length === 0) {
    return emptyContext(audit, review);
  }

  let best: { keyword: string; score: number; reason: ReviewKeywordWeaveReason } | null =
    null;

  for (const keyword of keywords) {
    const { score, reason } = scoreKeywordForReview(audit, review, keyword, options);
    if (score < SCORE_THRESHOLD) continue;

    if (!best || score > best.score) {
      best = { keyword, score, reason };
    }
  }

  if (!best) {
    return emptyContext(audit, review);
  }

  return buildContextForKeyword(audit, review, best.keyword, best.reason, options);
}

function rotationKeywords(audit: FullAuditPayload): string[] {
  const keywords = trackedKeywords(audit);
  const outside = keywords.filter((keyword) => isOutsidePack(audit, keyword));

  const ranked = (outside.length > 0 ? outside : keywords).sort((a, b) => {
    return reviewMentionsCount(audit, a) - reviewMentionsCount(audit, b);
  });

  return ranked.slice(0, 3);
}

/**
 * Assign per-review keyword contexts across a batch, rotating opportunities
 * so multiple replies can subtly cover different outside-pack gaps.
 */
export function assignReviewResponseKeywordContexts(
  audit: FullAuditPayload,
  reviews: ReviewRecord[],
  options?: ReviewResponseKeywordOptions
): Map<string, ReviewResponseKeywordContext> {
  const contexts = new Map<string, ReviewResponseKeywordContext>();
  const usedKeywords = new Set<string>();

  const positiveReviews = reviews.filter((review) => review.rating >= 3);

  for (const review of positiveReviews) {
    const context = resolveReviewResponseKeywordContext(audit, review, options);
    if (context.suggestedKeyword) {
      contexts.set(review.id, context);
      const reviewText = review.text ?? "";
      if (!textContainsKeyword(reviewText, context.suggestedKeyword)) {
        usedKeywords.add(context.suggestedKeyword.toLowerCase());
      }
    }
  }

  const rotation = rotationKeywords(audit);
  let rotationIndex = 0;

  for (const review of positiveReviews.filter((row) => row.rating >= 4 && !contexts.has(row.id))) {
    if (rotation.length === 0) break;

    let assigned = false;
    for (let attempt = 0; attempt < rotation.length; attempt += 1) {
      const keyword = rotation[(rotationIndex + attempt) % rotation.length];
      if (usedKeywords.has(keyword.toLowerCase())) continue;

      const { score } = scoreKeywordForReview(audit, review, keyword, options);
      if (score < ROTATION_SCORE_THRESHOLD) continue;

      contexts.set(
        review.id,
        buildContextForKeyword(audit, review, keyword, "batch_rotation", options)
      );
      usedKeywords.add(keyword.toLowerCase());
      rotationIndex = (rotationIndex + attempt + 1) % rotation.length;
      assigned = true;
      break;
    }

    if (!assigned) {
      rotationIndex = (rotationIndex + 1) % Math.max(rotation.length, 1);
    }
  }

  for (const review of reviews) {
    if (!contexts.has(review.id)) {
      contexts.set(review.id, emptyContext(audit, review));
    }
  }

  return contexts;
}

export function buildKeywordPromptBlock(context: ReviewResponseKeywordContext): string {
  if (!context.suggestedKeyword || context.skipReason) return "";

  const serviceTerm =
    context.serviceTokens[0] ?? context.suggestedKeyword.split(/\s+/).slice(0, 2).join(" ");

  const hooks =
    context.weaveHints.length > 0
      ? context.weaveHints.map((hint) => `- ${hint}`).join("\n")
      : "- weave in naturally if the reply allows";

  const areaLine = context.areaToken
    ? `- Area: ${context.areaToken} (only if relevant to their visit)\n`
    : "";

  return `
KEYWORD OPPORTUNITY (optional — skip if unnatural):
- Service focus: "${serviceTerm}" (not the full phrase "${context.suggestedKeyword}" unless the customer used it)
- Natural hooks:
${hooks}
${areaLine}- Do NOT use if: reply is primarily an apology, or the keyword would sound forced.`;
}

export function weaveReasonLabel(context: ReviewResponseKeywordContext): string | null {
  if (context.skipReason === "negative_review") {
    return "Focus on empathy — no keyword weave for negative reviews.";
  }
  if (!context.suggestedKeyword) {
    return context.skipReason === "already_covered"
      ? "Review already mentions this service."
      : null;
  }

  switch (context.reason) {
    case "review_mentions_service":
      return `Reinforce the service the customer mentioned (${context.suggestedKeyword}).`;
    case "customer_service_match":
      return `Customer record matches this service — weave "${context.suggestedKeyword}" if natural.`;
    case "outside_pack_gap":
      return `Subtle mention of "${context.suggestedKeyword}" — you're outside the local 3-Pack for this term.`;
    case "low_review_mentions":
      return `Few reviews mention "${context.suggestedKeyword}" — weave in if natural.`;
    case "batch_rotation":
      return `Optional service mention: "${context.suggestedKeyword}".`;
    case "active_campaign":
      return `Active review campaign for "${context.suggestedKeyword}" — reinforce if natural.`;
    default:
      return null;
  }
}
