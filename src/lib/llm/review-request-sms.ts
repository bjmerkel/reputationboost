import type { FullAuditPayload } from "@/audit/types";
import { generateReviewRequestSms as templateReviewRequestSms } from "@/audit/phase3/content";
import type { CustomerRecord } from "@/lib/customers/types";
import { customerFirstName, ensureBusinessInTemplate } from "@/lib/sms/personalize";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import { normalizeOptionalText } from "./normalize-content";

const REVIEW_REQUEST_SYSTEM = `You write short SMS messages asking happy customers to leave a Google review.

Rules:
- Under 300 characters (link placeholder counts as 25 chars)
- Warm, personal, not salesy — like a text from the business owner
- Always identify the business with [BUSINESS] so the customer knows who is texting
- Reference the customer's first name with [FIRST_NAME] placeholder
- Reference their service with [SERVICE] when provided
- Always include [REVIEW_LINK] exactly once — we substitute the real URL
- One clear ask: leave a quick Google review
- No emojis unless the business tone is very casual
- Do not invent details not in the context

Return valid JSON only: { "message": "the SMS text" }`;

export interface ReviewRequestContext {
  businessName: string;
  industry: string;
  city: string;
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
  const city = audit.gbp.identity.address.split(",")[1]?.trim() ?? "your area";
  return {
    businessName: audit.clientName,
    industry: audit.gbp.identity.primaryCategory,
    city,
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
  const service =
    context.sampleCustomer?.service_notes?.trim() ||
    context.focusKeyword ||
    "[SERVICE]";

  if (context.focusKeyword) {
    return `Hi ${firstName}! Thanks for choosing [BUSINESS] for ${service}. If your experience was great, a quick Google review about what we helped with would mean a lot: [REVIEW_LINK]`;
  }

  return `Hi ${firstName}! Thanks for trusting [BUSINESS] with ${service}. If you have 30 seconds, a quick Google review helps neighbors find us: [REVIEW_LINK]`;
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
    return ensureBusinessInTemplate(fallback, context.businessName);
  }

  try {
    const sampleLine = context.sampleCustomer
      ? `Sample customer: ${customerFirstName(context.sampleCustomer)}, service: ${context.sampleCustomer.service_notes ?? "recent visit"}`
      : "Use [FIRST_NAME], [SERVICE], and [BUSINESS] placeholders for personalization.";
    const keywordLine = context.focusKeyword
      ? `Priority keyword: "${context.focusKeyword}" — the business needs reviews that naturally mention this service. Use [SERVICE] for the customer's specific program; do not paste the full keyword verbatim unless it fits naturally.`
      : "";

    const llm = await completeJson<{ message: unknown }>(
      [
        { role: "system", content: REVIEW_REQUEST_SYSTEM },
        {
          role: "user",
          content: `Write an SMS review request for this business.

Business: ${context.businessName} (${context.industry}) in ${context.city}
Rating: ${context.averageRating}★ from ${context.reviewCount} reviews
Customers praise: ${context.positiveThemes.join(", ") || "quality work"}
${keywordLine}
${sampleLine}

Return JSON: { "message": "..." }`,
        },
      ],
      { maxTokens: 300 }
    );

    return ensureBusinessInTemplate(normalizeOptionalText(llm.message, fallback), context.businessName);
  } catch (error) {
    console.error("[llm] review request SMS generation failed:", error);
    return ensureBusinessInTemplate(fallback, context.businessName);
  }
}
