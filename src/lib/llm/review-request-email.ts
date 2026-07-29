import type { FullAuditPayload } from "@/audit/types";
import type { CustomerRecord } from "@/lib/customers/types";
import { normalizeKeywordInReviewTemplate } from "@/lib/review-requests/service-phrase";
import {
  customerFirstName,
  ensureBusinessInTemplate,
  normalizeUnsupportedPlaceholders,
} from "@/lib/sms/personalize";
import {
  buildReviewRequestContext,
  type GeoReviewPromptOptions,
  type ReviewRequestContext,
} from "@/lib/llm/review-request-sms";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import { normalizeOptionalText } from "./normalize-content";
import { formatStarRating } from "@/lib/format-star-rating";

const REVIEW_EMAIL_SYSTEM = `You write short, warm review-request emails asking happy customers to leave a Google review.

Rules:
- Professional but personal — like the business owner writing directly
- Subject line under 70 characters with [BUSINESS] placeholder
- Body 2-4 short paragraphs, under 500 characters total
- Always identify the business with [BUSINESS]
- Reference the customer's first name with [FIRST_NAME]
- Reference their service with [SERVICE] when provided
- Always include [REVIEW_LINK] exactly once in the body
- Use ONLY these placeholders: [FIRST_NAME], [SERVICE], [BUSINESS], [REVIEW_LINK]
- One clear ask: leave a quick Google review
- No emojis unless the business tone is very casual
- Do not invent details not in the context

Return valid JSON only: { "subject": "...", "body": "..." }`;

const GEO_REVIEW_EMAIL_SYSTEM = `You write short, warm review-request emails asking happy customers to leave a Google review.

Rules:
- Professional but personal — like the business owner writing directly
- Subject line under 70 characters with [BUSINESS] placeholder
- Body 2-4 short paragraphs, under 500 characters total
- Always identify the business with [BUSINESS]
- Reference [FIRST_NAME], [SERVICE], and [NEIGHBORHOOD] placeholders
- Gently suggest mentioning what service was done
- Always include [REVIEW_LINK] exactly once in the body
- Use ONLY these placeholders: [FIRST_NAME], [SERVICE], [NEIGHBORHOOD], [BUSINESS], [REVIEW_LINK]
- One clear ask: leave a quick Google review
- No emojis unless the business tone is very casual

Return valid JSON only: { "subject": "...", "body": "..." }`;

export interface ReviewEmailDraft {
  subject: string;
  body: string;
}

function finalizeEmailTemplate(
  draft: ReviewEmailDraft,
  context: ReviewRequestContext
): ReviewEmailDraft {
  const withBusiness = {
    subject: ensureBusinessInTemplate(draft.subject, context.businessName),
    body: ensureBusinessInTemplate(draft.body, context.businessName),
  };
  const normalized = {
    subject: normalizeUnsupportedPlaceholders(withBusiness.subject),
    body: normalizeUnsupportedPlaceholders(withBusiness.body),
  };
  return {
    subject: normalizeKeywordInReviewTemplate(normalized.subject, context.focusKeyword, {
      city: context.city,
      state: context.state,
    }),
    body: normalizeKeywordInReviewTemplate(normalized.body, context.focusKeyword, {
      city: context.city,
      state: context.state,
    }),
  };
}

function buildFallbackEmail(
  context: ReviewRequestContext,
  geo?: GeoReviewPromptOptions
): ReviewEmailDraft {
  const firstName = context.sampleCustomer
    ? customerFirstName(context.sampleCustomer)
    : "[FIRST_NAME]";

  if (geo?.geoTargeted) {
    return {
      subject: "How was your experience with [BUSINESS]?",
      body: `Hi ${firstName},\n\nThank you for trusting [BUSINESS] with your recent [SERVICE] in [NEIGHBORHOOD]. If you had a great experience, a quick Google review mentioning what we helped with would mean a lot to our team and neighbors nearby.\n\n[REVIEW_LINK]\n\nThank you,\n[BUSINESS]`,
    };
  }

  return {
    subject: "We'd love your feedback, [FIRST_NAME]",
    body: `Hi ${firstName},\n\nThank you for choosing [BUSINESS] for [SERVICE]. If your experience was great, would you take a moment to leave us a quick Google review? It helps neighbors find quality local businesses.\n\n[REVIEW_LINK]\n\nThank you,\n[BUSINESS]`,
  };
}

export async function generateReviewRequestEmail(
  audit: FullAuditPayload,
  sampleCustomer?: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes">,
  focusKeyword?: string | null,
  geo?: GeoReviewPromptOptions
): Promise<ReviewEmailDraft> {
  const context = buildReviewRequestContext(audit, sampleCustomer, focusKeyword);
  const fallback = buildFallbackEmail(context, geo);

  if (!isLlmConfigured()) {
    return finalizeEmailTemplate(fallback, context);
  }

  try {
    const sampleLine = context.sampleCustomer
      ? `Sample customer: ${customerFirstName(context.sampleCustomer)}, service: ${context.sampleCustomer.service_notes ?? "recent visit"}`
      : "Use [FIRST_NAME], [SERVICE], and [BUSINESS] placeholders for personalization.";
    const keywordLine = context.focusKeyword
      ? geo?.geoTargeted
        ? `Priority topic: "${geo.promptSeed ?? context.focusKeyword}" — gently nudge the customer to mention what service was done and the area.`
        : `Priority SEO keyword: "${context.focusKeyword}" — use [SERVICE] placeholder only; never paste the full keyword.`
      : "";
    const systemPrompt = geo?.geoTargeted ? GEO_REVIEW_EMAIL_SYSTEM : REVIEW_EMAIL_SYSTEM;

    const llm = await completeJson<{ subject: unknown; body: unknown }>(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Write a review request email for this business.

Business: ${context.businessName} (${context.industry}) in ${context.city}
Rating: ${formatStarRating(context.averageRating)}★ from ${context.reviewCount} reviews
Customers praise: ${context.positiveThemes.join(", ") || "quality work"}
${keywordLine}
${geo?.geoTargeted ? `Neighborhood placeholder: [NEIGHBORHOOD] → ${geo.neighborhoodLabel ?? context.city}` : ""}
${sampleLine}

Return JSON: { "subject": "...", "body": "..." }`,
        },
      ],
      { maxTokens: 500 }
    );

    return finalizeEmailTemplate(
      {
        subject: normalizeOptionalText(llm.subject, fallback.subject),
        body: normalizeOptionalText(llm.body, fallback.body),
      },
      context
    );
  } catch (error) {
    console.error("[llm] review request email generation failed:", error);
    return finalizeEmailTemplate(fallback, context);
  }
}
