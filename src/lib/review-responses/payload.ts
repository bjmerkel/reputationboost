import { keywordsHitInText } from "./keyword-quality";
import type { ReviewResponseKeywordContext } from "./keyword-context";
import {
  assignReviewResponseKeywordContexts,
  weaveReasonLabel,
} from "./keyword-context";
import type { FullAuditPayload } from "@/audit/types";
import type { ReviewResponseKeywordWeave } from "./types";

export type { ReviewResponseKeywordWeave } from "./types";

export function buildReviewResponseKeywordPayload(
  response: string,
  reviewText: string,
  context: ReviewResponseKeywordContext,
  allKeywords: string[]
): Record<string, unknown> {
  const keywordsHit = keywordsHitInText(response, allKeywords);
  const suggested = context.suggestedKeyword;
  const weaveSkipped =
    suggested != null && keywordsHit.every((keyword) => keyword.toLowerCase() !== suggested.toLowerCase())
      ? !keywordsHit.some((keyword) =>
          context.serviceTokens.some((token) => keyword.toLowerCase().includes(token))
        )
      : false;

  return {
    suggestedKeyword: suggested,
    keywordsHit,
    weaveSkipped: suggested ? weaveSkipped : false,
    weaveReason: weaveReasonLabel(context),
    targetKeywords: keywordsHit.length > 0 ? keywordsHit : suggested ? [suggested] : [],
  };
}

export function reviewResponseKeywordFields(
  audit: FullAuditPayload,
  reviewId: string,
  response: string,
  reviewText: string,
  precomputed?: ReviewResponseKeywordWeave
): Record<string, unknown> {
  const allKeywords = audit.rankings.keywords.map((keyword) => keyword.keyword);

  if (precomputed) {
    return {
      suggestedKeyword: precomputed.suggestedKeyword,
      keywordsHit: precomputed.keywordsHit,
      weaveSkipped: precomputed.weaveSkipped,
      weaveReason: precomputed.weaveReason,
      targetKeywords:
        precomputed.keywordsHit.length > 0
          ? precomputed.keywordsHit
          : precomputed.suggestedKeyword
            ? [precomputed.suggestedKeyword]
            : [],
    };
  }

  const review = audit.reviews.reviews.find((row) => row.id === reviewId);
  const context = assignReviewResponseKeywordContexts(audit, review ? [review] : []).get(
    reviewId
  );
  if (!context) {
    return {
      keywordsHit: keywordsHitInText(response, allKeywords),
      targetKeywords: keywordsHitInText(response, allKeywords),
    };
  }

  return buildReviewResponseKeywordPayload(response, reviewText, context, allKeywords);
}
