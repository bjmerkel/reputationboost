import type { FullAuditPayload, ReviewRecord } from "@/audit/types";
import { generateReviewResponses as templateReviewResponses } from "@/audit/phase3/content";
import { formatPolicyViolation } from "@/lib/google/gbp-reviews";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import { normalizeOptionalText } from "./normalize-content";

export interface GeneratedReviewResponse {
  reviewId: string;
  rating: number;
  response: string;
}

const REVIEW_RESPONSE_SYSTEM = `You write public Google Business Profile review replies on behalf of a local business owner.

Rules:
- Read the customer's review carefully and reference at least one SPECIFIC detail they mentioned (service, staff name, vehicle, event, complaint, praise).
- Match tone to star rating: warm gratitude for 4-5★, empathetic and accountable for 1-2★, constructive for 3★.
- 2-4 sentences. Professional, human, not corporate.
- For 1-2★ reviews: apologize sincerely, acknowledge their specific concern, invite them to call the business phone number to resolve offline.
- Never use copy-paste templates. Each reply must feel written only for that reviewer.
- Do not invent facts not supported by the review or business context.
- Use the reviewer's first name when natural.

Return valid JSON only: { "response": "the published reply text" }`;

function needsReviewResponse(review: ReviewRecord): boolean {
  if (!review.responded) return true;
  return review.replyState === "REJECTED";
}

async function generateOneReviewResponse(
  audit: FullAuditPayload,
  review: ReviewRecord
): Promise<string> {
  const business = audit.gbp.identity;
  const isRedraft = review.replyState === "REJECTED";
  const violation = formatPolicyViolation(review.policyViolation);

  const llm = await completeJson<{ response: unknown }>(
    [
      { role: "system", content: REVIEW_RESPONSE_SYSTEM },
      {
        role: "user",
        content: `Write a reply to this Google review.

BUSINESS:
- Name: ${audit.clientName}
- Category: ${business.primaryCategory}
- City/area: ${business.address}
- Phone: ${business.phone}

REVIEW:
- Rating: ${review.rating}★
- Author: ${review.author}
- Text: ${review.text || "(no written comment)"}
- Sentiment: ${review.sentiment}
${
  isRedraft
    ? `
PREVIOUS REPLY (REJECTED BY GOOGLE):
- Text: ${review.replyText ?? "(none)"}
- Policy issue: ${violation || "unspecified — avoid promotional language, personal info, or off-topic content"}
Rewrite a compliant reply that addresses the customer's review without violating Google policies.`
    : ""
}
Return JSON: { "response": "..." }`,
      },
    ],
    { temperature: 0.7, maxTokens: 350 }
  );

  const fallback = templateReviewResponses(audit).find((r) => r.reviewId === review.id);
  return normalizeOptionalText(llm.response, fallback?.response ?? "");
}

export async function generateReviewResponsesLlm(
  audit: FullAuditPayload
): Promise<GeneratedReviewResponse[]> {
  const pending = audit.reviews.reviews.filter(needsReviewResponse);

  if (pending.length === 0) return [];

  if (!isLlmConfigured()) {
    return templateReviewResponses(audit);
  }

  const results = await Promise.all(
    pending.map(async (review) => {
      try {
        const response = await generateOneReviewResponse(audit, review);
        return { reviewId: review.id, rating: review.rating, response };
      } catch (error) {
        console.error(`[llm] review response failed for ${review.id}:`, error);
        const fallback = templateReviewResponses(audit).find((r) => r.reviewId === review.id);
        return {
          reviewId: review.id,
          rating: review.rating,
          response: fallback?.response ?? "",
        };
      }
    })
  );

  return results.filter((r) => r.response.length > 0);
}
