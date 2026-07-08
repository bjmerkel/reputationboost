import type { FullAuditPayload, ReviewRecord } from "@/audit/types";
import {
  buildForcedKeywordContext,
  resolveReviewResponseKeywordContext,
  type ReviewResponseKeywordContext,
  type ReviewResponseKeywordOptions,
} from "./keyword-context";
import { generateReviewResponseDraft } from "@/lib/llm/review-responses";
import { buildReviewResponseKeywordPayload } from "./payload";
import type { ReviewResponseKeywordWeave } from "./types";

export interface RegenerateReviewResponseOptions extends ReviewResponseKeywordOptions {
  /** When true, force a weave attempt using fallbackKeyword or an active campaign keyword. */
  weaveKeyword?: boolean;
  /** Explicit keyword to weave (overrides weaveKeyword boolean). */
  keyword?: string | null;
  /** Prior suggested keyword from the task payload. */
  fallbackKeyword?: string | null;
}

export function resolveRegenerateKeywordContext(
  audit: FullAuditPayload,
  review: ReviewRecord,
  options: RegenerateReviewResponseOptions = {}
): ReviewResponseKeywordContext {
  const keywordOptions: ReviewResponseKeywordOptions = {
    activeCampaignKeywords: options.activeCampaignKeywords,
  };

  const explicit = options.keyword?.trim();
  if (explicit) {
    return buildForcedKeywordContext(audit, review, explicit, keywordOptions);
  }

  if (options.weaveKeyword) {
    const forced =
      options.fallbackKeyword?.trim() ||
      options.activeCampaignKeywords?.[0] ||
      resolveReviewResponseKeywordContext(audit, review, keywordOptions).suggestedKeyword;

    if (forced) {
      return buildForcedKeywordContext(audit, review, forced, keywordOptions);
    }
  }

  return resolveReviewResponseKeywordContext(audit, review, keywordOptions);
}

export async function regenerateReviewResponse(
  audit: FullAuditPayload,
  review: ReviewRecord,
  options: RegenerateReviewResponseOptions = {}
): Promise<{
  response: string;
  keywordWeave: ReviewResponseKeywordWeave;
  keywordPayload: Record<string, unknown>;
}> {
  const context = resolveRegenerateKeywordContext(audit, review, options);
  const draft = await generateReviewResponseDraft(audit, review, context);
  const allKeywords = audit.rankings.keywords.map((keyword) => keyword.keyword);
  const keywordPayload = buildReviewResponseKeywordPayload(
    draft.response,
    review.text ?? "",
    context,
    allKeywords
  );

  return {
    response: draft.response,
    keywordWeave: draft.keywordWeave,
    keywordPayload,
  };
}
