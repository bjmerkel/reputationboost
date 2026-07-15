import type { FullAuditPayload, ReviewRecord } from "@/audit/types";
import { generateReviewResponses as templateReviewResponses } from "@/audit/phase3/content";
import { formatPolicyViolation } from "@/lib/google/gbp-reviews";
import {
  assignReviewResponseKeywordContexts,
  buildKeywordPromptBlock,
  type ReviewResponseKeywordContext,
} from "@/lib/review-responses/keyword-context";
import {
  assessKeywordWeaveQuality,
  STRICT_KEYWORD_WEAVE_APPEND,
} from "@/lib/review-responses/keyword-quality";
import { buildReviewResponseKeywordPayload } from "@/lib/review-responses/payload";
import type { ReviewResponseKeywordWeave } from "@/lib/review-responses/types";
import type { ReviewResponseKeywordOptions } from "@/lib/review-responses/keyword-context";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import { normalizeOptionalText } from "./normalize-content";

export interface GeneratedReviewResponse {
  reviewId: string;
  rating: number;
  response: string;
  keywordWeave?: ReviewResponseKeywordWeave;
}

const REVIEW_RESPONSE_SYSTEM = `You write public Google Business Profile review replies on behalf of a local business owner.

Rules:
- Read the customer's review carefully and reference at least one SPECIFIC detail they mentioned (service, staff name, vehicle, event, complaint, praise).
- Paraphrase in the business's voice — never paste or truncate the customer's first-person sentences into the reply.
- Match tone to star rating: warm gratitude for 4-5★, empathetic and accountable for 1-2★, constructive for 3★.
- 2-4 sentences. Professional, human, not corporate.
- For 1-2★ reviews: apologize sincerely, acknowledge their specific concern, invite them to call the business phone number to resolve offline.
- Never use copy-paste templates. Each reply must feel written only for that reviewer.
- Do not invent facts not supported by the review or business context.
- Use the reviewer's first name when natural.

Local SEO (default when a keyword opportunity is provided):
- You will often receive a keyword opportunity for positive reviews. Prefer weaving it in naturally.
- Prefer the customer's own words or a short service term — never paste a long SEO phrase verbatim.
- Mention city/area only when it flows from the conversation (e.g. thanking a neighbor, referencing the visit).
- Skip only if the keyword would sound forced or the reply is primarily an apology. Never sacrifice authenticity for SEO.
- At most one service or location concept beyond what the customer already said.

Return valid JSON only: { "response": "the published reply text" }`;

function needsReviewResponse(review: ReviewRecord): boolean {
  if (!review.responded) return true;
  return review.replyState === "REJECTED";
}

/** Cap LLM review drafts during audits so content generation stays within time limits. */
const MAX_LLM_REVIEW_RESPONSES = 10;

function reviewResponsePriority(review: ReviewRecord): number {
  if (review.rating <= 2) return 0;
  if (review.rating === 3) return 1;
  return 2;
}

function selectReviewsForLlm(reviews: ReviewRecord[]): ReviewRecord[] {
  return [...reviews]
    .filter(needsReviewResponse)
    .sort((a, b) => reviewResponsePriority(a) - reviewResponsePriority(b))
    .slice(0, MAX_LLM_REVIEW_RESPONSES);
}

function trackedKeywords(audit: FullAuditPayload): string[] {
  return audit.rankings.keywords.map((keyword) => keyword.keyword);
}

async function generateOneReviewResponse(
  audit: FullAuditPayload,
  review: ReviewRecord,
  keywordContext: ReviewResponseKeywordContext,
  options?: { strictKeywordWeave?: boolean }
): Promise<string> {
  const business = audit.gbp.identity;
  const isRedraft = review.replyState === "REJECTED";
  const violation = formatPolicyViolation(review.policyViolation);
  const keywordBlock = buildKeywordPromptBlock(keywordContext);
  const strictAppend = options?.strictKeywordWeave ? STRICT_KEYWORD_WEAVE_APPEND : "";

  const llm = await completeJson<{ response: unknown }>(
    [
      {
        role: "system",
        content: `${REVIEW_RESPONSE_SYSTEM}${strictAppend}`,
      },
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
}${keywordBlock}
Return JSON: { "response": "..." }`,
      },
    ],
    { temperature: options?.strictKeywordWeave ? 0.4 : 0.7, maxTokens: 350 }
  );

  const fallback = templateReviewResponses(audit).find((r) => r.reviewId === review.id);
  return normalizeOptionalText(llm.response, fallback?.response ?? "");
}

async function generateWithQualityGate(
  audit: FullAuditPayload,
  review: ReviewRecord,
  keywordContext: ReviewResponseKeywordContext
): Promise<string> {
  const keywords = trackedKeywords(audit);
  let response = await generateOneReviewResponse(audit, review, keywordContext);
  const quality = assessKeywordWeaveQuality(
    response,
    review.text ?? "",
    keywordContext,
    keywords
  );

  if (quality.regenRecommended) {
    try {
      response = await generateOneReviewResponse(audit, review, keywordContext, {
        strictKeywordWeave: true,
      });
    } catch (error) {
      console.error(`[llm] review response strict regen failed for ${review.id}:`, error);
    }
  }

  return response;
}

function toKeywordWeavePayload(
  response: string,
  review: ReviewRecord,
  keywordContext: ReviewResponseKeywordContext,
  audit: FullAuditPayload
): GeneratedReviewResponse["keywordWeave"] {
  const payload = buildReviewResponseKeywordPayload(
    response,
    review.text ?? "",
    keywordContext,
    trackedKeywords(audit)
  );

  return {
    suggestedKeyword:
      typeof payload.suggestedKeyword === "string" ? payload.suggestedKeyword : null,
    keywordsHit: Array.isArray(payload.keywordsHit)
      ? payload.keywordsHit.filter((value): value is string => typeof value === "string")
      : [],
    weaveSkipped: payload.weaveSkipped === true,
    weaveReason: typeof payload.weaveReason === "string" ? payload.weaveReason : null,
    activeCampaignKeyword:
      typeof payload.activeCampaignKeyword === "string" ? payload.activeCampaignKeyword : null,
  };
}

export interface ReviewResponseGenerationOptions extends ReviewResponseKeywordOptions {}

export async function generateReviewResponseDraft(
  audit: FullAuditPayload,
  review: ReviewRecord,
  keywordContext: ReviewResponseKeywordContext
): Promise<{ response: string; keywordWeave: ReviewResponseKeywordWeave }> {
  if (!isLlmConfigured()) {
    const fallback = templateReviewResponses(audit).find((row) => row.reviewId === review.id);
    const response = fallback?.response ?? "";
    return {
      response,
      keywordWeave: toKeywordWeavePayload(response, review, keywordContext, audit)!,
    };
  }

  const response = await generateWithQualityGate(audit, review, keywordContext);
  return {
    response,
    keywordWeave: toKeywordWeavePayload(response, review, keywordContext, audit)!,
  };
}

export async function generateReviewResponsesLlm(
  audit: FullAuditPayload,
  options?: ReviewResponseGenerationOptions
): Promise<GeneratedReviewResponse[]> {
  const pending = selectReviewsForLlm(audit.reviews.reviews);

  if (pending.length === 0) return [];

  const keywordContexts = assignReviewResponseKeywordContexts(audit, pending, options);

  if (!isLlmConfigured()) {
    return templateReviewResponses(audit).map((row) => {
      const review = audit.reviews.reviews.find((item) => item.id === row.reviewId);
      const context =
        keywordContexts.get(row.reviewId) ??
        assignReviewResponseKeywordContexts(audit, review ? [review] : [], options).get(
          row.reviewId
        );
      if (!review || !context) {
        return row;
      }
      return {
        ...row,
        keywordWeave: toKeywordWeavePayload(row.response, review, context, audit),
      };
    });
  }

  const results = await Promise.all(
    pending.map(async (review) => {
      const keywordContext =
        keywordContexts.get(review.id) ??
        assignReviewResponseKeywordContexts(audit, [review], options).get(review.id)!;

      try {
        const draft = await generateReviewResponseDraft(audit, review, keywordContext);
        return {
          reviewId: review.id,
          rating: review.rating,
          response: draft.response,
          keywordWeave: draft.keywordWeave,
        };
      } catch (error) {
        console.error(`[llm] review response failed for ${review.id}:`, error);
        const fallback = templateReviewResponses(audit).find((r) => r.reviewId === review.id);
        const response = fallback?.response ?? "";
        return {
          reviewId: review.id,
          rating: review.rating,
          response,
          keywordWeave: toKeywordWeavePayload(response, review, keywordContext, audit),
        };
      }
    })
  );

  return results.filter((r) => r.response.length > 0);
}

export { buildReviewResponseKeywordPayload } from "@/lib/review-responses/payload";
