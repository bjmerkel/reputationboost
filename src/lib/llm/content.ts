import type { FullAuditPayload } from "@/audit/types";
import {
  generateGbpDescription as templateGbpDescription,
  generateGooglePosts as templateGooglePosts,
  generateReviewRequestSms as templateReviewRequestSms,
  generateReviewResponses as templateReviewResponses,
} from "@/audit/phase3/content";
import { sanitizeGbpDescriptionDraft } from "@/lib/google/gbp-description";
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

export interface AuditGeneratedContent {
  googlePosts: string[];
  gbpDescription: string;
  reviewResponses: Array<{ reviewId: string; rating: number; response: string }>;
  reviewRequestSms: string;
  qaAnswer: string;
  socialPost: string;
  gbpPhotoJobs: GbpPhotoJob[];
  contentSource: "llm" | "template";
}

interface LlmContentResponse {
  googlePosts: unknown[];
  gbpDescription: unknown;
  reviewRequestSms: unknown;
  qaAnswer: unknown;
  socialPost: unknown;
}

const CONTENT_SYSTEM = `You are a local marketing copywriter for Google Business Profile.
Write publish-ready copy: specific, local, trustworthy. Use the business name, city, and real review themes.
Google Posts: max 1500 chars each, include a clear CTA. The phone number may appear in posts. Use 1 emoji max per post.
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
    qaAnswer: `Q: What areas do you serve?\nA: We proudly serve ${audit.gbp.identity.address} and surrounding neighborhoods. Call ${audit.gbp.identity.phone} for availability.`,
    socialPost: templateGooglePosts(audit)[0] ?? "",
    gbpPhotoJobs: buildTemplatePhotoJobs(audit),
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
  const [reviewResponses, gbpPhotoJobs] = await Promise.all([
    generateReviewResponsesLlm(audit),
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
  "reviewRequestSms": "SMS under 300 chars with [REVIEW_LINK], [FIRST_NAME], and [SERVICE] placeholders",
  "qaAnswer": "Q: ... A: ... format for service area question",
  "socialPost": "1 Facebook/Instagram post as a plain string"
}

Each googlePosts entry must be a string, not an object.`,
        },
      ],
      { maxTokens: 3000 }
    );

    const googlePosts = normalizeTextList(llm.googlePosts, fallback.googlePosts);

    return {
      googlePosts: googlePosts.length >= 4 ? googlePosts.slice(0, 4) : fallback.googlePosts,
      gbpDescription: sanitizeGbpDescriptionDraft(
        normalizeOptionalText(llm.gbpDescription, fallback.gbpDescription)
      ),
      reviewResponses,
      reviewRequestSms: normalizeOptionalText(llm.reviewRequestSms, fallback.reviewRequestSms),
      qaAnswer: normalizeOptionalText(llm.qaAnswer, fallback.qaAnswer),
      socialPost: normalizeOptionalText(llm.socialPost, fallback.socialPost),
      gbpPhotoJobs,
      contentSource: "llm",
    };
  } catch (error) {
    console.error("[llm] content generation failed, using templates:", error);
    return { ...fallback, reviewResponses, gbpPhotoJobs };
  }
}
