import type { FullAuditPayload, ExecutionType } from "../types";

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

export function generateGbpDescription(audit: FullAuditPayload): string {
  const themes = audit.reviews.sentiment.positiveThemes.slice(0, 3).join(", ");
  return `${audit.clientName} is a trusted ${audit.gbp.identity.primaryCategory} serving ${audit.gbp.identity.address}. ` +
    `With ${audit.gbp.engagement.reviewCount} Google reviews (${audit.gbp.engagement.averageRating}★), we specialize in local projects customers praise for ${themes || "quality and professionalism"}. ` +
    `Book online or call ${audit.gbp.identity.phone} for fast, reliable service.`;
}

export function generateReviewResponses(audit: FullAuditPayload): Array<{
  reviewId: string;
  rating: number;
  response: string;
}> {
  return audit.reviews.reviews
    .filter((r) => !r.responded || r.replyState === "REJECTED")
    .map((r) => ({
      reviewId: r.id,
      rating: r.rating,
      response: buildTemplateReviewResponse(audit, r),
    }));
}

function excerpt(text: string, maxLen = 80): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen).trim()}…`;
}

function buildTemplateReviewResponse(
  audit: FullAuditPayload,
  review: { id: string; rating: number; text: string; author: string }
): string {
  const phone = audit.gbp.identity.phone;
  const name = review.author.split(" ")[0] || review.author;
  const detail = excerpt(review.text);

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

  return detail
    ? `Thank you so much, ${name}! We're glad ${detail.charAt(0).toLowerCase()}${detail.slice(1)} meant a lot to you. We truly appreciate your support!`
    : `Thank you so much, ${name}! We're thrilled you had a great experience with ${audit.clientName}. We appreciate your support!`;
}

export function generateReviewRequestSms(audit: FullAuditPayload): string {
  return `Hi! Thanks for choosing ${audit.clientName}. We'd love your feedback — it helps us on Google Maps. Leave a quick review here: [REVIEW_LINK]`;
}

export function mapActionToExecutionType(actionId: string): ExecutionType | null {
  if (actionId === "stale-posts" || actionId === "competitor-post-frequency") return "google_post";
  if (actionId === "low-photos") return "gbp_photo";
  if (actionId === "missing-video") return "gbp_video";
  if (actionId.startsWith("missing-media-")) return "gbp_photo";
  if (actionId === "miscategorized-media" || actionId === "stale-media") {
    return "gbp_media_recategorize";
  }
  if (actionId.startsWith("rank-outside-pack")) return "gbp_description";
  if (actionId === "unresponded-negative" || actionId === "low-response-rate") return "review_response";
  if (actionId.startsWith("review-gap")) return "review_request";
  if (actionId === "unanswered-qa") return "qa_answer";
  if (actionId === "missing-schema") return "schema_markup";
  if (actionId === "citation-mismatch") return "citation_fix";
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
