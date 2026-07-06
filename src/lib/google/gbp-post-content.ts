import { stripPhoneNumbersFromText, stripUrlsFromText } from "./gbp-description";

/** Google local post summary limit (characters). */
export const GBP_POST_SUMMARY_MAX_LENGTH = 1500;

/**
 * Deal/promotion phrasing that hotel and lodging profiles cannot publish in
 * any post type (Google reserves pricing surfaces for organic and ad prices),
 * and which belongs in OFFER posts (not STANDARD) for other businesses.
 */
const OFFER_LANGUAGE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b\d+\s*%\s*off\b/i, label: "percentage discounts" },
  { pattern: /\b(discount|discounts|deal|deals)\b/i, label: "deal or discount mentions" },
  { pattern: /\b(promo code|coupon|promotion|promotions)\b/i, label: "promo or coupon language" },
  { pattern: /\b(special offer|limited time offer)\b/i, label: "special-offer phrasing" },
];

export interface GbpPostSanitizeResult {
  text: string;
  removedUrls: boolean;
  removedPhoneNumbers: boolean;
  /** Deal/promo phrasing detected — blocked for hotels, OFFER-only for others. */
  offerLanguageWarnings: string[];
}

export function detectPostOfferLanguage(text: string): string[] {
  const warnings: string[] = [];
  for (const { pattern, label } of OFFER_LANGUAGE_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push(label);
    }
    pattern.lastIndex = 0;
  }
  return warnings;
}

/**
 * Prepare a Google local post summary for publishing. Google disallows phone
 * numbers and URLs in post text — contact actions belong in the post's CTA
 * button ("Call now" uses the verified profile number; "Learn more" carries
 * the link). Preserves line breaks, which are valid in post summaries.
 */
export function sanitizeGbpPostSummary(text: string): GbpPostSanitizeResult {
  const working = text.replace(/\r\n/g, "\n").trim();

  const { text: withoutUrls, removed: removedUrls } = stripUrlsFromText(working);
  const { text: withoutPhones, removed: removedPhoneNumbers } =
    stripPhoneNumbersFromText(withoutUrls);

  const normalized = withoutPhones
    .replace(/[ \t]+/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const truncated =
    normalized.length > GBP_POST_SUMMARY_MAX_LENGTH
      ? normalized.slice(0, GBP_POST_SUMMARY_MAX_LENGTH).trim()
      : normalized;

  return {
    text: truncated,
    removedUrls,
    removedPhoneNumbers,
    offerLanguageWarnings: detectPostOfferLanguage(truncated),
  };
}

export function buildPostSanitizeNote(result: GbpPostSanitizeResult): string | null {
  const notes: string[] = [];
  if (result.removedPhoneNumbers) {
    notes.push(
      "phone numbers were removed from the post text — the Call button links customers to your verified profile number"
    );
  }
  if (result.removedUrls) {
    notes.push(
      "URLs were removed from the post text — use a Learn more / Sign up button to link a page"
    );
  }
  if (result.offerLanguageWarnings.length > 0) {
    notes.push(
      `the post mentions ${result.offerLanguageWarnings.join(", ")} — hotel and lodging profiles cannot publish posts with deals or promotions, and other businesses should use an Offer post type instead`
    );
  }
  if (notes.length === 0) return null;
  return `Note: ${notes.join("; ")}.`;
}

/** Clean a generated post draft before it is shown or stored. */
export function sanitizeGbpPostDraft(text: string): string {
  return sanitizeGbpPostSummary(text).text;
}
