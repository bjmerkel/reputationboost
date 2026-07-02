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
    .filter((r) => !r.responded)
    .map((r) => ({
      reviewId: r.id,
      rating: r.rating,
      response:
        r.rating <= 2
          ? `Thank you for your honest feedback, ${r.author}. We're sorry we missed the mark. Please contact us at ${audit.gbp.identity.phone} — we'd like to make this right.`
          : r.rating === 3
            ? `Thanks for sharing your experience, ${r.author}. We're always working to improve — reach out anytime at ${audit.gbp.identity.phone}.`
            : `Thank you so much, ${r.author}! We're thrilled you had a great experience. We appreciate your support!`,
    }));
}

export function generateReviewRequestSms(audit: FullAuditPayload): string {
  return `Hi! Thanks for choosing ${audit.clientName}. We'd love your feedback — it helps us on Google Maps. Leave a quick review here: [REVIEW_LINK]`;
}

export function mapActionToExecutionType(actionId: string): ExecutionType | null {
  if (actionId === "stale-posts" || actionId === "competitor-post-frequency") return "google_post";
  if (actionId === "low-photos") return "gbp_services";
  if (actionId.startsWith("rank-outside-pack")) return "gbp_description";
  if (actionId === "unresponded-negative" || actionId === "low-response-rate") return "review_response";
  if (actionId.startsWith("review-gap")) return "review_request";
  if (actionId === "unanswered-qa") return "qa_answer";
  if (actionId === "missing-schema") return "schema_markup";
  if (actionId === "citation-mismatch") return "citation_fix";
  if (actionId === "low-social") return "social_post";
  if (actionId === "missing-holiday-hours") return "gbp_services";
  return null;
}
