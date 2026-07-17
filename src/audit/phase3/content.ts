import type { FullAuditPayload, ExecutionType } from "../types";
import type { ReviewResponseKeywordContext } from "@/lib/review-responses/keyword-context";
import {
  assignReviewResponseKeywordContexts,
  extractAreaToken,
} from "@/lib/review-responses/keyword-context";
import { naturalServicePhrase } from "@/lib/review-requests/service-phrase";
import { buildGbpDescriptionDraft } from "@/lib/google/gbp-description-draft";
import type { ReviewResponseDraft } from "@/lib/review-responses/types";
import { isReviewRecordResponded } from "@/audit/review-engagement";
import { formatStarRating } from "@/lib/format-star-rating";

export function generateGooglePosts(audit: FullAuditPayload): string[] {
  const city = audit.gbp.identity.address.split(",")[1]?.trim() ?? "your area";
  const service = audit.gbp.identity.primaryCategory;
  const rating = formatStarRating(audit.gbp.engagement.averageRating);
  const reviews = audit.gbp.engagement.reviewCount;

  const topKeyword =
    audit.rankings.keywords.find((k) => !k.inLocalPack)?.keyword ??
    audit.rankings.keywords[0]?.keyword ??
    service;

  return [
    `🏠 Looking for ${service} in ${city}? We're local experts with ${reviews}+ reviews and a ${rating}★ rating. Call today for a free estimate!`,
    `Did you know? ${Math.round(audit.rankings.shareOfVoice)}% of your target keywords put you in the Google Maps top 3. Let's get the rest there — contact us about "${topKeyword}" services.`,
    `Customer spotlight: "${audit.reviews.sentiment.positiveThemes[0] ?? "quality work"}" — thank you to our ${city} neighbors for the trust! Book your project this week.`,
    `Spring into action! ${service} season is here. Google Maps search "${topKeyword}" to find us, or call for same-week availability.`,
  ];
}

// Google's description guidelines: no phone numbers, URLs, or sales CTAs —
// those belong in dedicated profile fields.
export function generateGbpDescription(audit: FullAuditPayload): string {
  return buildGbpDescriptionDraft(audit);
}

export function generateReviewResponses(audit: FullAuditPayload): ReviewResponseDraft[] {
  const pending = audit.reviews.reviews.filter(
    (r) => !isReviewRecordResponded(r) || r.replyState === "REJECTED"
  );
  const keywordContexts = assignReviewResponseKeywordContexts(audit, pending);

  return pending.map((r) => ({
    reviewId: r.id,
    rating: r.rating,
    response: buildTemplateReviewResponse(
      audit,
      r,
      keywordContexts.get(r.id) ?? null
    ),
  }));
}

/**
 * Legacy template pasted truncated first-person review text into
 * "We're glad … meant a lot to you" — detect those so reconcile can refresh.
 */
export function looksLikeMangledReviewReply(text: string): boolean {
  const cleaned = text.trim();
  if (!cleaned) return false;
  if (/…\s*meant a lot to you/i.test(cleaned)) return true;
  if (/\.\.\.\s*meant a lot to you/i.test(cleaned)) return true;
  // Long first-person paste between "We're glad" and "meant a lot"
  if (/we're glad\s+my\b.{20,}meant a lot to you/i.test(cleaned)) return true;
  if (/we're glad\s+.{80,}meant a lot to you/i.test(cleaned)) return true;
  return false;
}

function locationFromAddress(address: string): { city: string | null; state: string | null } {
  const parts = address.split(",").map((part) => part.trim());
  const city = parts[1] || null;
  const stateZip = parts[2] ?? "";
  const state = stateZip.split(/\s+/)[0] || null;
  return { city, state };
}

function resolveServicePhrase(
  audit: FullAuditPayload,
  keywordContext: ReviewResponseKeywordContext | null
): string | null {
  const keyword = keywordContext?.suggestedKeyword?.trim();
  if (!keyword) return null;

  const location = locationFromAddress(audit.gbp.identity.address);
  const phrase = naturalServicePhrase(keyword, location);
  if (phrase) return phrase;

  return keywordContext?.serviceTokens[0] ?? null;
}

/** Short praise themes we can reference without pasting the customer's words. */
const PRAISE_THEME_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bteachers?\b/i, label: "teachers" },
  { pattern: /\bfront desk\b/i, label: "front desk team" },
  { pattern: /\bstaff\b/i, label: "staff" },
  { pattern: /\b(class|classroom)\b/i, label: "classroom" },
  { pattern: /\b(numbers?|letters?|academically)\b/i, label: "learning progress" },
  { pattern: /\bfriends?\b/i, label: "friendships" },
  { pattern: /\b(songs?|singing)\b/i, label: "songs and activities" },
  { pattern: /\b(summer camp|camp)\b/i, label: "summer programs" },
  { pattern: /\b(clean|punctual|professional)\b/i, label: "professional service" },
  { pattern: /\b(friendly|welcoming|patient|caring)\b/i, label: "caring team" },
];

function extractPraiseThemes(text: string, limit = 2): string[] {
  const themes: string[] = [];
  for (const { pattern, label } of PRAISE_THEME_PATTERNS) {
    if (!pattern.test(text)) continue;
    if (themes.includes(label)) continue;
    themes.push(label);
    if (themes.length >= limit) break;
  }
  return themes;
}

function formatThemeMention(themes: string[]): string {
  if (themes.length === 0) return "";
  if (themes.length === 1) return themes[0];
  return `${themes[0]} and ${themes[1]}`;
}

function positiveSpecificOpener(name: string, reviewText: string, clientName: string): string {
  const themes = extractPraiseThemes(reviewText);
  if (themes.length > 0) {
    return `Thank you so much, ${name}! It means so much that you mentioned our ${formatThemeMention(themes)}.`;
  }
  return `Thank you so much, ${name}! We're thrilled you had a great experience with ${clientName}.`;
}

function weaveCloser(area: string | null, servicePhrase: string | null): string | null {
  if (servicePhrase && area) {
    return `We're grateful to serve ${area} families at our ${servicePhrase}.`;
  }
  if (servicePhrase) {
    return `We're grateful for your support of our ${servicePhrase} team.`;
  }
  if (area) {
    return `We're grateful to serve neighbors here in ${area}.`;
  }
  return null;
}

export function buildTemplateReviewResponse(
  audit: FullAuditPayload,
  review: { id: string; rating: number; text: string; author: string },
  keywordContext: ReviewResponseKeywordContext | null = null
): string {
  const phone = audit.gbp.identity.phone;
  const name = review.author.split(" ")[0] || review.author;
  const area = extractAreaToken(audit.gbp.identity.address);
  const servicePhrase = resolveServicePhrase(audit, keywordContext);
  const canWeaveKeyword = review.rating >= 3 && Boolean(servicePhrase);
  const themes = extractPraiseThemes(review.text, 1);
  const concern = themes[0] ?? null;

  if (review.rating <= 2) {
    return concern
      ? `Thank you for your honest feedback, ${name}. We're sorry your experience with our ${concern} didn't meet expectations. Please call us at ${phone} so we can make this right.`
      : `Thank you for your honest feedback, ${name}. We're sorry we missed the mark. Please contact us at ${phone} — we'd like to make this right.`;
  }

  if (review.rating === 3) {
    const improveFocus = canWeaveKeyword && servicePhrase ? ` our ${servicePhrase}` : "";
    return concern
      ? `Thanks for sharing your experience, ${name}. We hear you on ${concern} and we're always working to improve${improveFocus} — reach out anytime at ${phone}.`
      : `Thanks for sharing your experience, ${name}. We're always working to improve${improveFocus} — reach out anytime at ${phone}.`;
  }

  const opener = positiveSpecificOpener(name, review.text, audit.clientName);
  const closer =
    (canWeaveKeyword ? weaveCloser(area, servicePhrase) : null) ??
    weaveCloser(area, null) ??
    "We truly appreciate your support!";

  return `${opener} ${closer}`;
}

export function generateReviewRequestSms(audit: FullAuditPayload): string {
  return `Hi [FIRST_NAME]! Thanks for choosing [BUSINESS]. We'd love your feedback — it helps neighbors find us on Google. Leave a quick review here: [REVIEW_LINK]`;
}

export function mapActionToExecutionType(actionId: string): ExecutionType | null {
  if (actionId === "stale-posts" || actionId === "competitor-post-frequency") return "google_post";
  if (actionId === "low-photos") return "gbp_photo";
  if (actionId === "missing-video") return "gbp_video";
  if (actionId.startsWith("missing-media-")) return "gbp_photo";
  if (
    actionId === "low-media-engagement" ||
    actionId === "customer-photos-dominate"
  ) {
    return "gbp_photo";
  }
  if (actionId === "zero-view-owner-photos") return "gbp_media_delete";
  if (
    actionId === "missing-pubsub-notifications" ||
    actionId === "incomplete-notification-types"
  ) {
    return "gbp_notifications";
  }
  if (
    actionId === "missing-place-action-links" ||
    actionId === "incomplete-place-action-links"
  ) {
    return "gbp_place_action";
  }
  if (
    actionId === "local-posts-api-unavailable" ||
    actionId === "rejected-local-posts" ||
    actionId === "posts-without-cta"
  ) {
    return "google_post";
  }
  if (actionId === "miscategorized-media" || actionId === "stale-media") {
    return "gbp_photo";
  }
  if (actionId.startsWith("rank-outside-pack")) return "gbp_description";
  if (actionId === "unresponded-negative" || actionId === "low-response-rate") return "review_response";
  if (actionId === "dispute-candidates") return "review_dispute";
  if (
    actionId === "rejected-review-replies" ||
    actionId === "pending-review-replies"
  ) {
    return "review_response";
  }
  if (actionId.startsWith("review-gap")) return "review_request";
  if (actionId === "missing-schema") return "schema_markup";
  if (actionId === "low-social") return "social_post";
  if (actionId === "missing-holiday-hours" || actionId === "missing-hours" || actionId === "incomplete-week-hours") {
    return "gbp_hours";
  }
  if (actionId === "low-attributes") return "gbp_attributes";
  if (actionId === "google-pending-edits" || actionId === "google-suggested-edits") {
    return "gbp_accept_suggestion";
  }
  if (actionId.startsWith("nap-drift-title")) return "gbp_title";
  if (actionId.startsWith("nap-drift-phone")) return "gbp_phone";
  if (actionId.startsWith("nap-drift-website")) return "gbp_website";
  if (actionId.startsWith("nap-drift-address")) return "gbp_address";
  return null;
}
