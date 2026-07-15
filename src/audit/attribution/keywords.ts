import type { ExecutionTask } from "@/audit/types";
import { keywordsHitInText } from "@/lib/review-responses/keyword-quality";

const KEYWORD_STOP_WORDS = new Set([
  "near",
  "best",
  "local",
  // Generic nouns that appear in many SEO keywords but are too weak alone
  "center",
  "centre",
  "service",
  "services",
  "company",
  "shop",
  "store",
  "place",
  "area",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Significant tokens from a keyword phrase (drops short words and stop words). */
export function significantKeywordTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3 && !KEYWORD_STOP_WORDS.has(word));
}

/**
 * Whole-word token match (with simple plurals). Avoids "child" matching "children".
 */
export function textHasSignificantToken(text: string, token: string): boolean {
  const escaped = escapeRegExp(token.toLowerCase());
  const lower = text.toLowerCase();
  if (new RegExp(`\\b${escaped}\\b`, "i").test(lower)) return true;
  if (new RegExp(`\\b${escaped}s\\b`, "i").test(lower)) return true;
  if (new RegExp(`\\b${escaped}es\\b`, "i").test(lower)) return true;
  return false;
}

/**
 * Whether text covers a keyword's concepts — token overlap, not exact phrase match.
 * "CarPlay installations in Arlington" matches "carplay installation arlington va".
 */
export function textContainsKeyword(text: string, keyword: string): boolean {
  const tokens = significantKeywordTokens(keyword);
  if (tokens.length === 0) return text.toLowerCase().includes(keyword.toLowerCase());
  return tokens.some((token) => textHasSignificantToken(text, token));
}

/** Keywords whose concepts are not represented in text (smart token matching). */
export function keywordsMissingFromText(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => !textContainsKeyword(text, keyword));
}

/** Match business keywords mentioned in text (case-insensitive exact phrase). */
export function matchKeywordsInText(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
}

/** Resolve which keywords an execution task likely affects. */
export function resolveTargetKeywords(task: ExecutionTask, keywords: string[]): string[] {
  const fromPayload = task.payload.targetKeywords;
  if (Array.isArray(fromPayload)) {
    const resolved = fromPayload.filter((k): k is string => typeof k === "string" && k.length > 0);
    if (resolved.length > 0) return resolved;
  }

  const fromDraft = matchKeywordsInText(task.draftContent, keywords);
  if (fromDraft.length > 0) return fromDraft;

  const reviewText = String(task.payload.reviewText ?? "");
  const fromReview = matchKeywordsInText(reviewText, keywords);
  if (fromReview.length > 0) return fromReview;

  const hint = String(task.payload.hint ?? task.payload.keyword ?? "");
  const fromHint = matchKeywordsInText(hint, keywords);
  if (fromHint.length > 0) return fromHint;

  switch (task.type) {
    case "review_response": {
      const fromHit = task.payload.keywordsHit;
      if (Array.isArray(fromHit)) {
        const resolved = fromHit.filter((k): k is string => typeof k === "string" && k.length > 0);
        if (resolved.length > 0) return resolved;
      }
      const fromDraftHits = keywordsHitInText(task.draftContent, keywords);
      if (fromDraftHits.length > 0) return fromDraftHits;
      return [];
    }
    case "gbp_description":
    case "gbp_services":
    case "gbp_primary_category":
    case "gbp_secondary_categories":
      return keywords;
    default:
      return keywords.length > 0 ? [keywords[0]] : [];
  }
}

/** Pick the primary keyword for attribution (best rank improvement or first match). */
export function pickPrimaryKeyword(
  targetKeywords: string[],
  rankByKeyword: Map<string, { before: number | null; after: number | null }>
): string | null {
  if (targetKeywords.length === 0) return null;
  if (targetKeywords.length === 1) return targetKeywords[0];

  let best: { keyword: string; delta: number } | null = null;

  for (const keyword of targetKeywords) {
    const ranks = rankByKeyword.get(keyword);
    if (!ranks) continue;
    const before = ranks.before ?? 99;
    const after = ranks.after ?? 99;
    const delta = before - after;
    if (!best || delta > best.delta) {
      best = { keyword, delta };
    }
  }

  return best?.keyword ?? targetKeywords[0];
}
