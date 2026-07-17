import type { Phase1AuditPayload } from "@/audit/types";
import {
  keywordsMissingFromText,
  significantKeywordTokens,
  textContainsKeyword,
} from "@/audit/attribution/keywords";
import { formatStarRating } from "@/lib/format-star-rating";
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
  "in",
  "the",
  "a",
  "an",
  "for",
  "and",
  "or",
  "of",
]);

const US_STATE_CODES = new Set([
  "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia","ks","ky","la",
  "me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj","nm","ny","nc","nd","oh","ok",
  "or","pa","ri","sc","sd","tn","tx","ut","vt","va","wa","wv","wi","wy","dc",
]);

/** Themes that must never appear as praise in a marketing description. */
const NEGATIVE_SOUNDING_THEMES = new Set(["scheduling delays", "hard to reach"]);

const STATE_OR_ZIP = /^(?:[A-Z]{2}|[A-Z]{2}\s+\d{5}(?:-\d{4})?|\d{5}(?:-\d{4})?)$/i;
const COUNTRY_LIKE = /^(?:USA|US|United States|Canada|UK|United Kingdom)$/i;
const LOOKS_LIKE_PLACE = /^(?:[a-z]+(?:['-][a-z]+)*(?:\s+[a-z]+(?:['-][a-z]+)*){0,2})$/i;

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

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9']/g, ""))
      .filter(Boolean)
  );
}

/**
 * Turn a Maps-style query into a short natural service phrase.
 * Drops "near me", superlatives, the business city, and trailing other-city tokens.
 */
export function naturalKeywordPhrase(keyword: string, city?: string): string {
  const cityTokens = tokenSet(city ?? "");

  const words = keyword
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9'-]/g, ""))
    .filter((word) => word.length > 0)
    .filter((word) => !SEARCH_JUNK.has(word))
    .filter((word) => !cityTokens.has(word))
    .filter((word) => !/^\d{5}(-\d{4})?$/.test(word))
    .filter((word) => !US_STATE_CODES.has(word));

  // Drop trailing place-name tokens ("newark", "kearny") that aren't the business city.
  while (words.length > 1) {
    const last = words[words.length - 1]!;
    const isServiceWord =
      /repair|install|service|contractor|heating|cooling|hvac|plumbing|cleaning|care|center|centre|tutoring|school|ac|hvac/.test(
        last
      );
    if (isServiceWord) break;
    if (LOOKS_LIKE_PLACE.test(last) && last.length >= 4) {
      words.pop();
      continue;
    }
    break;
  }

  if (words.length === 0) {
    return significantKeywordTokens(keyword)[0] ?? keyword.trim();
  }

  // Keep descriptions readable — long SEO strings read as keyword stuffing.
  return words.slice(0, 4).join(" ");
}

/** Detect legacy and current weak templates that should be regenerated. */
export function looksLikeKeywordStuffedDescription(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (/clean vehicles|punctual arrivals|24\/7 availability/i.test(normalized)) return true;
  if (/provides professional .+ throughout .+ and surrounding areas/i.test(normalized)) return true;
  if (/we specialize in .+, .+, .+/i.test(normalized)) return true;
  if (/the team is known for .+, with a focus on .+/i.test(normalized)) return true;
  if (/helps customers get dependable results close to home/i.test(normalized)) return true;
  if (/\d+\.\d{3,}★/.test(normalized)) return true; // unformatted float ratings
  const nearMeCount = (normalized.match(/\bnear me\b/gi) ?? []).length;
  if (nearMeCount >= 2) return true;
  return false;
}

function targetKeywords(audit: Phase1AuditPayload): string[] {
  return audit.rankings.keywords.map((row) => row.keyword);
}

function reviewThemes(audit: Phase1AuditPayload): string {
  const themes = audit.reviews.sentiment.positiveThemes
    .filter((theme) => !NEGATIVE_SOUNDING_THEMES.has(theme.toLowerCase()))
    .slice(0, 3);
  if (themes.length === 0) return "quality work and reliable service";
  if (themes.length === 1) return themes[0]!;
  if (themes.length === 2) return `${themes[0]} and ${themes[1]}`;
  return `${themes[0]}, ${themes[1]}, and ${themes[2]}`;
}

function categoryPhrase(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return "local business";
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/** Choose "a" / "an" from the spoken start of a phrase. */
export function indefiniteArticle(phrase: string): string {
  const spoken = phrase
    .trim()
    .replace(/^[^a-z0-9]+/i, "")
    .toLowerCase();
  if (!spoken) return "a";
  return /^[aeiou]/i.test(spoken) ? "an" : "a";
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

function joinPhrases(phrases: string[]): string {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0]!;
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases[phrases.length - 1]}`;
}

function focusServicePhrases(audit: Phase1AuditPayload): string[] {
  const city = cityFromAddress(audit.gbp.identity.address);
  const serviceNames = (audit.gbp.liveProfile?.services ?? [])
    .map((service) => service.name.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (serviceNames.length > 0) return serviceNames;

  return targetKeywords(audit)
    .map((keyword) => naturalKeywordPhrase(keyword, city))
    .filter((phrase) => phrase.length > 2)
    .filter(
      (phrase, index, all) =>
        all.findIndex((other) => other.toLowerCase() === phrase.toLowerCase()) === index
    )
    .slice(0, 3);
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
    .filter((phrase) => phrase.length > 2)
    .filter((phrase) => !textCoversPhrase(base, phrase))
    .filter(
      (phrase, index, all) =>
        all.findIndex((other) => other.toLowerCase() === phrase.toLowerCase()) === index
    )
    .slice(0, 2);

  if (phrases.length === 0) return base;

  const addition =
    phrases.length === 1
      ? ` Customers also trust ${audit.clientName} for ${phrases[0]} in ${city}.`
      : ` Customers also trust ${audit.clientName} for ${phrases[0]} and ${phrases[1]} in ${city}.`;

  const trimmed = base.trim();
  if (trimmed.endsWith(".")) {
    return truncateDescription(`${trimmed.slice(0, -1)}.${addition}`);
  }
  return truncateDescription(`${trimmed}${addition}`);
}

function buildFreshDescription(audit: Phase1AuditPayload): string {
  const city = cityFromAddress(audit.gbp.identity.address);
  const category = categoryPhrase(audit.gbp.identity.primaryCategory);
  const article = indefiniteArticle(category);
  const reviews = audit.gbp.engagement.reviewCount;
  const rating = formatStarRating(audit.gbp.engagement.averageRating);
  const themes = reviewThemes(audit);
  const focusPhrases = focusServicePhrases(audit);
  const focusClause = joinPhrases(
    focusPhrases.length > 0 ? focusPhrases : [category]
  );

  return truncateDescription(
    `${audit.clientName} is ${article} ${category} in ${city}, specializing in ${focusClause}. ` +
      `Customers value our ${themes}. ` +
      `Whether you need help today or are planning a larger project, our team delivers dependable results for homes and businesses in ${city} and nearby communities. ` +
      `With ${reviews}+ Google reviews (${rating}★), ${audit.clientName} is ready to help.`
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
    if (missing.length === 0) {
      return sanitizeGbpDescriptionDraft(live);
    }

    const woven = weaveMissingKeywords(live, audit, missing);
    // Never replace strong live copy with something that reads like stuffing.
    if (looksLikeKeywordStuffedDescription(woven) || woven.length < live.length * 0.8) {
      return sanitizeGbpDescriptionDraft(live);
    }
    return woven;
  }

  const fresh = buildFreshDescription(audit);
  const missing = keywordsMissingFromText(fresh, keywords);
  return weaveMissingKeywords(fresh, audit, missing);
}
