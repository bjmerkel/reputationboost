import type { FullAuditPayload } from "@/audit/types";
import { generateReviewRequestSms as templateReviewRequestSms } from "@/audit/phase3/content";
import type { CustomerRecord } from "@/lib/customers/types";
import { normalizeKeywordInReviewTemplate } from "@/lib/review-requests/service-phrase";
import {
  customerFirstName,
  ensureBusinessInTemplate,
  normalizeUnsupportedPlaceholders,
} from "@/lib/sms/personalize";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import { normalizeOptionalText } from "./normalize-content";
import { formatStarRating } from "@/lib/format-star-rating";

const REVIEW_REQUEST_SYSTEM = `You write short SMS messages asking happy customers to leave a Google review.

Rules:
- Under 300 characters (link placeholder counts as 25 chars)
- Warm, personal, not salesy — like a text from the business owner
- Always identify the business with [BUSINESS] so the customer knows who is texting
- Reference the customer's first name with [FIRST_NAME] placeholder
- Reference their service with [SERVICE] when provided — we substitute a short program name (e.g. "enrichment programs"), never a full SEO keyword or city name
- Always include [REVIEW_LINK] exactly once — we substitute the real URL
- Use ONLY these placeholders: [FIRST_NAME], [SERVICE], [BUSINESS], [REVIEW_LINK] — never [OWNER_NAME] or any other bracket tokens
- One clear ask: leave a quick Google review
- No emojis unless the business tone is very casual
- Do not invent details not in the context
- Do not mention city, state, or location in the SMS — use [SERVICE] instead of pasting keyword phrases

Return valid JSON only: { "message": "the SMS text" }`;

export interface ReviewRequestContext {
  businessName: string;
  industry: string;
  city: string;
  state: string;
  phone: string;
  averageRating: number;
  reviewCount: number;
  positiveThemes: string[];
  focusKeyword?: string | null;
  sampleCustomer?: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes">;
}

export function buildReviewRequestContext(
  audit: FullAuditPayload,
  sampleCustomer?: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes">,
  focusKeyword?: string | null
): ReviewRequestContext {
  const addressParts = audit.gbp.identity.address.split(",").map((part) => part.trim());
  const city = addressParts[1] ?? "your area";
  const state = addressParts[2]?.split(/\s+/)[0] ?? "";
  return {
    businessName: audit.clientName,
    industry: audit.gbp.identity.primaryCategory,
    city,
    state,
    phone: audit.gbp.identity.phone,
    averageRating: audit.gbp.engagement.averageRating,
    reviewCount: audit.gbp.engagement.reviewCount,
    positiveThemes: audit.reviews.sentiment.positiveThemes.slice(0, 3),
    focusKeyword,
    sampleCustomer,
  };
}

export function buildTemplateReviewRequestMessage(context: ReviewRequestContext): string {
  const firstName = context.sampleCustomer
    ? customerFirstName(context.sampleCustomer)
    : "[FIRST_NAME]";

  if (context.focusKeyword) {
    return `Hi ${firstName}! Thanks for choosing [BUSINESS] for [SERVICE]. If your experience was great, a quick Google review about what we helped with would mean a lot: [REVIEW_LINK]`;
  }

  return `Hi ${firstName}! Thanks for trusting [BUSINESS] with [SERVICE]. If you have 30 seconds, a quick Google review helps neighbors find us: [REVIEW_LINK]`;
}

function finalizeReviewRequestTemplate(
  template: string,
  context: ReviewRequestContext
): string {
  const withBusiness = ensureBusinessInTemplate(template, context.businessName);
  const normalized = normalizeUnsupportedPlaceholders(withBusiness);
  return normalizeKeywordInReviewTemplate(normalized, context.focusKeyword, {
    city: context.city,
    state: context.state,
  });
}

export async function generateReviewRequestMessage(
  audit: FullAuditPayload,
  sampleCustomer?: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes">,
  focusKeyword?: string | null
): Promise<string> {
  const context = buildReviewRequestContext(audit, sampleCustomer, focusKeyword);
  const fallback = templateReviewRequestSms(audit).includes("[FIRST_NAME]")
    ? templateReviewRequestSms(audit)
    : buildTemplateReviewRequestMessage(context);

  if (!isLlmConfigured()) {
    return finalizeReviewRequestTemplate(fallback, context);
  }

  try {
    const sampleLine = context.sampleCustomer
      ? `Sample customer: ${customerFirstName(context.sampleCustomer)}, service: ${context.sampleCustomer.service_notes ?? "recent visit"}`
      : "Use [FIRST_NAME], [SERVICE], and [BUSINESS] placeholders for personalization.";
    const keywordLine = context.focusKeyword
      ? `Priority SEO keyword: "${context.focusKeyword}" — reviews should eventually mention this topic, but the SMS must sound natural. Use only the [SERVICE] placeholder for the program name (e.g. "enrichment programs"); never paste the full keyword or "${context.city}" in the message.`
      : "";

    const llm = await completeJson<{ message: unknown }>(
      [
        { role: "system", content: REVIEW_REQUEST_SYSTEM },
        {
          role: "user",
          content: `Write an SMS review request for this business.

Business: ${context.businessName} (${context.industry}) in ${context.city}
Rating: ${formatStarRating(context.averageRating)}★ from ${context.reviewCount} reviews
Customers praise: ${context.positiveThemes.join(", ") || "quality work"}
${keywordLine}
${sampleLine}

Return JSON: { "message": "..." }`,
        },
      ],
      { maxTokens: 300 }
    );

    return finalizeReviewRequestTemplate(
      normalizeOptionalText(llm.message, fallback),
      context
    );
  } catch (error) {
    console.error("[llm] review request SMS generation failed:", error);
    return finalizeReviewRequestTemplate(fallback, context);
  }
}
