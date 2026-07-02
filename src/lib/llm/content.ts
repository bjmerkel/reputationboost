import type { FullAuditPayload } from "@/audit/types";
import {
  generateGbpDescription as templateGbpDescription,
  generateGooglePosts as templateGooglePosts,
  generateReviewRequestSms as templateReviewRequestSms,
  generateReviewResponses as templateReviewResponses,
} from "@/audit/phase3/content";
import { buildContentContext } from "./audit-context";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";

export interface AuditGeneratedContent {
  googlePosts: string[];
  gbpDescription: string;
  reviewResponses: Array<{ reviewId: string; rating: number; response: string }>;
  reviewRequestSms: string;
  qaAnswer: string;
  socialPost: string;
  contentSource: "llm" | "template";
}

interface LlmContentResponse {
  googlePosts: string[];
  gbpDescription: string;
  reviewResponses: Array<{ reviewId: string; response: string }>;
  reviewRequestSms: string;
  qaAnswer: string;
  socialPost: string;
}

const CONTENT_SYSTEM = `You are a local marketing copywriter for Google Business Profile.
Write publish-ready copy: specific, local, trustworthy. Use the business name, city, phone, and real review themes.
Google Posts: max 1500 chars each, include a clear CTA. Use 1 emoji max per post.
Review responses: empathetic, professional; negative reviews invite offline resolution with phone number.
GBP description: 600-750 characters, keyword-rich but natural.
Return valid JSON only.`;

export function buildTemplateContent(audit: FullAuditPayload): AuditGeneratedContent {
  const responses = templateReviewResponses(audit);
  return {
    googlePosts: templateGooglePosts(audit),
    gbpDescription: templateGbpDescription(audit),
    reviewResponses: responses,
    reviewRequestSms: templateReviewRequestSms(audit),
    qaAnswer: `Q: What areas do you serve?\nA: We proudly serve ${audit.gbp.identity.address} and surrounding neighborhoods. Call ${audit.gbp.identity.phone} for availability.`,
    socialPost: templateGooglePosts(audit)[0] ?? "",
    contentSource: "template",
  };
}

function templateContent(audit: FullAuditPayload): AuditGeneratedContent {
  return buildTemplateContent(audit);
}

export async function generateAuditContent(
  audit: FullAuditPayload
): Promise<AuditGeneratedContent> {
  const fallback = templateContent(audit);

  if (!isLlmConfigured()) {
    return fallback;
  }

  try {
    const context = buildContentContext(audit);
    const pendingReviews = audit.reviews.reviews
      .filter((r) => !r.responded)
      .map((r) => ({ reviewId: r.id, rating: r.rating, author: r.author, text: r.text }));

    const llm = await completeJson<LlmContentResponse>(
      [
        { role: "system", content: CONTENT_SYSTEM },
        {
          role: "user",
          content: `Generate GBP execution content for this business.

CONTEXT:
${context}

REVIEWS NEEDING RESPONSES:
${JSON.stringify(pendingReviews)}

Return JSON:
{
  "googlePosts": ["4 unique monthly Google Posts"],
  "gbpDescription": "optimized business description",
  "reviewResponses": [{ "reviewId": "id from input", "response": "published reply" }],
  "reviewRequestSms": "SMS under 160 chars with [REVIEW_LINK] placeholder",
  "qaAnswer": "Q: ... A: ... format for service area question",
  "socialPost": "1 Facebook/Instagram post"
}`,
        },
      ],
      { maxTokens: 3500 }
    );

    const reviewResponses = pendingReviews.map((review) => {
      const llmResponse = llm.reviewResponses?.find((r) => r.reviewId === review.reviewId);
      const template = fallback.reviewResponses.find((r) => r.reviewId === review.reviewId);
      return {
        reviewId: review.reviewId,
        rating: review.rating,
        response: llmResponse?.response ?? template?.response ?? fallback.reviewRequestSms,
      };
    });

    return {
      googlePosts:
        llm.googlePosts?.length >= 4 ? llm.googlePosts.slice(0, 4) : fallback.googlePosts,
      gbpDescription: llm.gbpDescription || fallback.gbpDescription,
      reviewResponses,
      reviewRequestSms: llm.reviewRequestSms || fallback.reviewRequestSms,
      qaAnswer: llm.qaAnswer || fallback.qaAnswer,
      socialPost: llm.socialPost || fallback.socialPost,
      contentSource: "llm",
    };
  } catch (error) {
    console.error("[llm] content generation failed, using templates:", error);
    return fallback;
  }
}
