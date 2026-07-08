import { textContainsKeyword } from "@/audit/attribution/keywords";
import type { ReviewResponseKeywordContext } from "./keyword-context";

export interface KeywordWeaveQualityResult {
  ok: boolean;
  forcedPhrase: boolean;
  stuffing: boolean;
  regenRecommended: boolean;
}

const MAX_KEYWORD_CONCEPTS = 2;

/** Keywords whose concepts appear in text (token overlap). */
export function keywordsHitInText(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => textContainsKeyword(text, keyword));
}

export function isForcedExactPhrase(
  response: string,
  keyword: string,
  reviewText: string
): boolean {
  const phrase = keyword.trim().toLowerCase();
  if (!phrase || phrase.split(/\s+/).length < 3) return false;

  const responseLower = response.toLowerCase();
  if (!responseLower.includes(phrase)) return false;

  return !reviewText.toLowerCase().includes(phrase);
}

export function assessKeywordWeaveQuality(
  response: string,
  reviewText: string,
  context: ReviewResponseKeywordContext,
  allKeywords: string[]
): KeywordWeaveQualityResult {
  if (!context.suggestedKeyword) {
    return { ok: true, forcedPhrase: false, stuffing: false, regenRecommended: false };
  }

  const forcedPhrase = isForcedExactPhrase(
    response,
    context.suggestedKeyword,
    reviewText
  );
  const conceptCount = keywordsHitInText(response, allKeywords).length;
  const stuffing = conceptCount > MAX_KEYWORD_CONCEPTS;

  return {
    ok: !forcedPhrase && !stuffing,
    forcedPhrase,
    stuffing,
    regenRecommended: forcedPhrase || stuffing,
  };
}

export const STRICT_KEYWORD_WEAVE_APPEND = `
STRICT: Remove any long SEO keyword phrases. Use at most one short service term. Prioritize sounding human over SEO.`;
