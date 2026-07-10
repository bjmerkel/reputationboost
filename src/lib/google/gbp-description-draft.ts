import type { Phase1AuditPayload } from "@/audit/types";
import {
  keywordsMissingFromText,
  significantKeywordTokens,
  textContainsKeyword,
} from "@/audit/attribution/keywords";
import { GBP_DESCRIPTION_MAX_LENGTH, sanitizeGbpDescriptionDraft } from "@/lib/google/gbp-description";

const SEARCH_JUNK = new Set([
  "near",
  "me",
  "best",
  "top",
  "cheap",
  "affordable",
  "local",
  "nearby",
  "around",
]);

const STATE_OR_ZIP = /^(?:[A-Z]{2}|[A-Z]{2}\s+\d{5}(?:-\d{4})?|\d{5}(?:-\d{4})?)$/i;
const COUNTRY_LIKE = /^(?:USA|US|United States|Canada|UK|United Kingdom)$/i;

/** City/locality from a mailing address, skipping state/ZIP/country segments. */
export function cityFromAddress(address: string): string {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i]!;
    if (STATE_OR_ZIP.test(part) || COUNTRY_LIKE.test(part)) continue;
    // "Las Vegas NV 89129" packed into one segment
    const cityStateZip = part.match(/^(.+?)\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i);
    if (cityStateZip?.[1]) return cityStateZip[1].trim();
    if (part.length >= 2) return part;
  }

  return "your area";
}

/** Turn a Maps-style query into a short natural phrase (no "near me" / superlatives). */
export function naturalKeywordPhrase(keyword: string, city?: string): string {
  const cityTokens = new Set(
    (city ?? "")
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9']/g, ""))
      .filter(Boolean)
  );

  const words = keyword
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9'-]/g, ""))
    .filter((word) => word.length > 0)
    .filter((word) => !SEARCH_JUNK.has(word))
    .filter((word) => !cityTokens.has(word))
    .filter((word) => !/^\d{5}(-\d{4})?$/.test(word));

  if (words.length === 0) {
    return significantKeywordTokens(keyword)[0] ?? keyword.trim();
  }

  return words.join(" ");
}

/** Detect the old template that lists keywords and uses trade-agnostic filler. */
export function looksLikeKeywordStuffedDescription(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (/clean vehicles|punctual arrivals|24\/7 availability/i.test(normalized)) return true;
  if (/provides professional .+ throughout .+ and surrounding areas/i.test(normalized)) return true;
  if (/we specialize in .+, .+, .+/i.test(normalized)) return true;
  const nearMeCount = (normalized.match(/\bnear me\b/gi) ?? []).length;
  if (nearMeCount >= 2) return true;
  return false;
}

function targetKeywords(audit: Phase1AuditPayload): string[] {
  return audit.rankings.keywords.map((row) => row.keyword);
}

function reviewThemes(audit: Phase1AuditPayload): string {
  const themes = audit.reviews.sentiment.positiveThemes.slice(0, 3);
  if (themes.length === 0) return "quality and care";
  if (themes.length === 1) return themes[0]!;
  if (themes.length === 2) return `${themes[0]} and ${themes[1]}`;
  return `${themes[0]}, ${themes[1]}, and ${themes[2]}`;
}

function categoryPhrase(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return "local business";
  // Avoid "professional Day care center" — use the category as a noun phrase as-is.
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function truncateDescription(text: string): string {
  const cleaned = sanitizeGbpDescriptionDraft(text);
  if (cleaned.length <= GBP_DESCRIPTION_MAX_LENGTH) return cleaned;
  const sliced = cleaned.slice(0, GBP_DESCRIPTION_MAX_LENGTH);
  const lastSentence = Math.max(sliced.lastIndexOf(". "), sliced.lastIndexOf("! "));
  if (lastSentence >= GBP_DESCRIPTION_MAX_LENGTH * 0.6) {
    return sliced.slice(0, lastSentence + 1).trim();
  }
  return sliced.trim();
}

function textCoversPhrase(text: string, phrase: string): boolean {
  if (textContainsKeyword(text, phrase)) return true;
  const lower = text.toLowerCase();
  const tokens = significantKeywordTokens(phrase);
  if (tokens.length === 0) return lower.includes(phrase.toLowerCase());
  return tokens.every((token) => {
    if (lower.includes(token)) return true;
    if (token.endsWith("s") && token.length > 4 && lower.includes(token.slice(0, -1))) {
      return true;
    }
    return false;
  });
}

function weaveMissingKeywords(
  base: string,
  audit: Phase1AuditPayload,
  missing: string[]
): string {
  if (missing.length === 0) return base;

  const city = cityFromAddress(audit.gbp.identity.address);
  const phrases = missing
    .map((keyword) => naturalKeywordPhrase(keyword, city))
    .filter((phrase) => phrase.length > 0)
    .filter((phrase) => !textCoversPhrase(base, phrase))
    // De-dupe similar phrases
    .filter(
      (phrase, index, all) =>
        all.findIndex((other) => other.toLowerCase() === phrase.toLowerCase()) === index
    )
    .slice(0, 3);

  if (phrases.length === 0) return base;

  let addition: string;
  if (phrases.length === 1) {
    addition = ` Customers also come to ${audit.clientName} for ${phrases[0]} in ${city}.`;
  } else if (phrases.length === 2) {
    addition = ` Customers also come to ${audit.clientName} for ${phrases[0]} and ${phrases[1]} in ${city}.`;
  } else {
    addition = ` Customers also come to ${audit.clientName} for ${phrases[0]}, ${phrases[1]}, and ${phrases[2]} in ${city}.`;
  }

  const trimmed = base.trim();
  if (trimmed.endsWith(".")) {
    return truncateDescription(`${trimmed.slice(0, -1)}.${addition}`);
  }
  return truncateDescription(`${trimmed}${addition}`);
}

function buildFreshDescription(audit: Phase1AuditPayload): string {
  const city = cityFromAddress(audit.gbp.identity.address);
  const category = categoryPhrase(audit.gbp.identity.primaryCategory);
  const reviews = audit.gbp.engagement.reviewCount;
  const rating = audit.gbp.engagement.averageRating;
  const themes = reviewThemes(audit);

  const serviceNames = (audit.gbp.liveProfile?.services ?? [])
    .map((service) => service.name.trim())
    .filter(Boolean)
    .slice(0, 4);

  const keywordPhrases = targetKeywords(audit)
    .map((keyword) => naturalKeywordPhrase(keyword, city))
    .filter(Boolean)
    .filter((phrase, index, all) =>
      all.findIndex((other) => other.toLowerCase() === phrase.toLowerCase()) === index
    )
    .slice(0, 4);

  const focusPhrases =
    serviceNames.length > 0
      ? serviceNames
      : keywordPhrases.length > 0
        ? keywordPhrases
        : [category];

  let focusClause: string;
  if (focusPhrases.length === 1) {
    focusClause = focusPhrases[0]!;
  } else if (focusPhrases.length === 2) {
    focusClause = `${focusPhrases[0]} and ${focusPhrases[1]}`;
  } else {
    focusClause = `${focusPhrases.slice(0, -1).join(", ")}, and ${focusPhrases[focusPhrases.length - 1]}`;
  }

  return truncateDescription(
    `${audit.clientName} is a ${category} serving ${city} and nearby communities. ` +
      `The team is known for ${themes}, with a focus on ${focusClause}. ` +
      `With ${reviews}+ Google reviews (${rating}★), ${audit.clientName} helps customers get dependable results close to home.`
  );
}

/**
 * Build a publish-ready GBP description draft.
 * Prefers enhancing a strong live description over replacing it with keyword lists.
 */
export function buildGbpDescriptionDraft(audit: Phase1AuditPayload): string {
  const live = audit.gbp.liveProfile?.description?.trim() ?? "";
  const keywords = targetKeywords(audit);

  if (live && !looksLikeKeywordStuffedDescription(live) && live.length >= 200) {
    const missing = keywordsMissingFromText(live, keywords);
    return weaveMissingKeywords(live, audit, missing);
  }

  const fresh = buildFreshDescription(audit);
  const missing = keywordsMissingFromText(fresh, keywords);
  return weaveMissingKeywords(fresh, audit, missing);
}
