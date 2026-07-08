import type { FullAuditPayload } from "@/audit/types";
import {
  generateGbpDescription as templateGbpDescription,
  generateGooglePosts as templateGooglePosts,
  generateReviewRequestSms as templateReviewRequestSms,
  generateReviewResponses as templateReviewResponses,
} from "@/audit/phase3/content";
import { sanitizeGbpDescriptionDraft } from "@/lib/google/gbp-description";
import { sanitizeGbpPostDraft } from "@/lib/google/gbp-post-content";
import { buildContentContext } from "./audit-context";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import {
  normalizeOptionalText,
  normalizeTextContent,
  normalizeTextList,
} from "./normalize-content";
import { generateReviewResponsesLlm } from "./review-responses";
import {
  buildTemplatePhotoJobs,
  generateGbpPhotoJobsLlm,
  type GbpPhotoJob,
} from "./gbp-photos";

import type { ReviewResponseDraft } from "@/lib/review-responses/types";
import type { ReviewResponseGenerationOptions } from "@/lib/llm/review-responses";

export interface AuditGeneratedContent {
  googlePosts: string[];
  gbpDescription: string;
  reviewResponses: ReviewResponseDraft[];
  reviewRequestSms: string;
  socialPost: string;
  gbpPhotoJobs: GbpPhotoJob[];
  contentSource: "llm" | "template";
}

interface LlmContentResponse {
  googlePosts: unknown[];
  gbpDescription: unknown;
  reviewRequestSms: unknown;
  socialPost: unknown;
}

const CONTENT_SYSTEM = `You are a local marketing copywriter for Google Business Profile.
Write publish-ready copy: specific, local, trustworthy. Use the business name, city, and real review themes.
Google Posts: max 1500 chars each. Use 1 emoji max per post. NEVER include a phone number or URL in the post text — Google rejects posts containing them. Each post is published with a "Call" action button that links to the verified profile number, so end with a CTA like "Tap Call to book" instead of writing contact details. Do not mention deals, discounts, promo codes, or special offers (hotel profiles cannot post them at all, and other businesses need a dedicated Offer post type).
GBP description: 600-750 characters, keyword-rich but natural. Plain text only — no URLs, HTML, sales pitches, discount claims, or superlatives like "cheapest" or "#1".
CRITICAL for the GBP description: NEVER include a phone number, email address, or "Call us at ..." style CTA. Google's guidelines require contact details to live in their dedicated profile fields, and descriptions containing them get rejected. End the description with what makes the business trustworthy, not a call to action.
Return valid JSON only.`;

export function buildTemplateContent(audit: FullAuditPayload): AuditGeneratedContent {
  const responses = templateReviewResponses(audit);
  return {
    googlePosts: templateGooglePosts(audit),
    gbpDescription: templateGbpDescription(audit),
    reviewResponses: responses,
    reviewRequestSms: templateReviewRequestSms(audit),
    socialPost: templateGooglePosts(audit)[0] ?? "",
    gbpPhotoJobs: buildTemplatePhotoJobs(audit),
    contentSource: "template",
  };
}

function templateContent(audit: FullAuditPayload): AuditGeneratedContent {
  return buildTemplateContent(audit);
}

export async function generateAuditContent(
  audit: FullAuditPayload,
  options?: ReviewResponseGenerationOptions
): Promise<AuditGeneratedContent> {
  const fallback = templateContent(audit);
  const [reviewResponses, gbpPhotoJobs] = await Promise.all([
    generateReviewResponsesLlm(audit, options),
    generateGbpPhotoJobsLlm(audit),
  ]);

  if (!isLlmConfigured()) {
    return { ...fallback, reviewResponses, gbpPhotoJobs };
  }

  try {
    const context = buildContentContext(audit);

    const llm = await completeJson<LlmContentResponse>(
      [
        { role: "system", content: CONTENT_SYSTEM },
        {
          role: "user",
          content: `Generate GBP execution content for this business.

CONTEXT:
${context}

Return JSON:
{
  "googlePosts": ["4 unique monthly Google Posts as plain strings"],
  "gbpDescription": "optimized business description",
  "reviewRequestSms": "SMS under 300 chars with [REVIEW_LINK], [FIRST_NAME], [SERVICE], and [BUSINESS] placeholders",
  "socialPost": "1 Facebook/Instagram post as a plain string"
}

Each googlePosts entry must be a string, not an object.`,
        },
      ],
      { maxTokens: 3000 }
    );

    const googlePosts = normalizeTextList(llm.googlePosts, fallback.googlePosts).map(
      sanitizeGbpPostDraft
    );

    return {
      googlePosts: googlePosts.length >= 4 ? googlePosts.slice(0, 4) : fallback.googlePosts,
      gbpDescription: sanitizeGbpDescriptionDraft(
        normalizeOptionalText(llm.gbpDescription, fallback.gbpDescription)
      ),
      reviewResponses,
      reviewRequestSms: normalizeOptionalText(llm.reviewRequestSms, fallback.reviewRequestSms),
      socialPost: normalizeOptionalText(llm.socialPost, fallback.socialPost),
      gbpPhotoJobs,
      contentSource: "llm",
    };
  } catch (error) {
    console.error("[llm] content generation failed, using templates:", error);
    return { ...fallback, reviewResponses, gbpPhotoJobs };
  }
}
