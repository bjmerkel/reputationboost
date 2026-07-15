import type { FullAuditPayload, ExecutionType } from "../types";
import type { ReviewResponseKeywordContext } from "@/lib/review-responses/keyword-context";
import {
  assignReviewResponseKeywordContexts,
  extractAreaToken,
} from "@/lib/review-responses/keyword-context";
import { naturalServicePhrase } from "@/lib/review-requests/service-phrase";
import { buildGbpDescriptionDraft } from "@/lib/google/gbp-description-draft";

export function generateGooglePosts(audit: FullAuditPayload): string[] {
  const city = audit.gbp.identity.address.split(",")[1]?.trim() ?? "your area";
  const service = audit.gbp.identity.primaryCategory;
  const rating = audit.gbp.engagement.averageRating;
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

import type { ReviewResponseDraft } from "@/lib/review-responses/types";
import { isReviewRecordResponded } from "@/audit/review-engagement";

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

/** Max length for a phrase we can embed mid-sentence without sounding broken. */
const EMBEDDABLE_DETAIL_MAX = 72;

/**
 * Short praise suitable for embedding in a reply. Returns null for long or
 * first-person narrative reviews — those must not be truncated into templates
 * like "We're glad my son has been going here since May of 2019… meant a lot".
 */
function extractEmbeddableDetail(text: string): string | null {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  if (cleaned.length > EMBEDDABLE_DETAIL_MAX) return null;
  // Multi-sentence or first-person stories read as the business speaking as the customer
  if (cleaned.includes(". ") || cleaned.includes("! ") || cleaned.includes("? ")) return null;
  if (/^(i|i'm|i’m|i've|i’ve|my|we|we're|we’re|our|me)\b/i.test(cleaned)) return null;
  return cleaned.replace(/[.!?]+$/u, "").trim() || null;
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

function buildTemplateReviewResponse(
  audit: FullAuditPayload,
  review: { id: string; rating: number; text: string; author: string },
  keywordContext: ReviewResponseKeywordContext | null = null
): string {
  const phone = audit.gbp.identity.phone;
  const name = review.author.split(" ")[0] || review.author;
  const detail = extractEmbeddableDetail(review.text);
  const area = extractAreaToken(audit.gbp.identity.address);
  const servicePhrase = resolveServicePhrase(audit, keywordContext);
  const canWeaveKeyword = review.rating >= 4 && Boolean(servicePhrase);

  if (review.rating <= 2) {
    return detail
      ? `Thank you for your honest feedback, ${name}. We're sorry your experience didn't meet expectations — especially regarding "${detail}". Please call us at ${phone} so we can make this right.`
      : `Thank you for your honest feedback, ${name}. We're sorry we missed the mark. Please contact us at ${phone} — we'd like to make this right.`;
  }

  if (review.rating === 3) {
    return detail
      ? `Thanks for sharing your experience, ${name}. We hear you on "${detail}" and we're always working to improve — reach out anytime at ${phone}.`
      : `Thanks for sharing your experience, ${name}. We're always working to improve — reach out anytime at ${phone}.`;
  }

  if (canWeaveKeyword && area && servicePhrase) {
    return detail
      ? `Thank you so much, ${name}! We're so glad to hear "${detail}" — we love helping ${area} neighbors with ${servicePhrase}.`
      : `Thank you so much, ${name}! We're thrilled you had a great experience with ${audit.clientName}. We love helping ${area} neighbors with ${servicePhrase}.`;
  }

  if (canWeaveKeyword && servicePhrase) {
    return detail
      ? `Thank you so much, ${name}! We're so glad to hear "${detail}" — we truly appreciate your support for our ${servicePhrase} team.`
      : `Thank you so much, ${name}! We're thrilled you had a great experience with ${audit.clientName}. We appreciate your support for our ${servicePhrase} team!`;
  }

  return detail
    ? `Thank you so much, ${name}! We're so glad to hear "${detail}". We truly appreciate your support!`
    : `Thank you so much, ${name}! We're thrilled you had a great experience with ${audit.clientName}. We appreciate your support!`;
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
