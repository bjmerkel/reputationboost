import type { FullAuditPayload } from "@/audit/types";
import { formatCurrency } from "@/audit/attribution/roi";
import { DEFAULT_ROI_CONFIG } from "@/audit/attribution/roi";
import { computeKeywordScores } from "@/audit/phase2/keyword-scores";
import {
  keywordImpressionWeight,
  positionClickShare,
  resolveKeywordPosition,
} from "@/audit/phase2/scoring";
import type { LearnedScoreModel } from "@/audit/phase2/score-learning";
import { DEFAULT_LEARNED_SCORE_MODEL } from "@/audit/phase2/score-learning";
import type { KeywordRevenueMonthly, RankValueDelta } from "./types";
import { MIN_OBSERVED_ACV_SAMPLES } from "./observed-acv";

function clampRank(rank: number): number {
  return Math.max(1, Math.min(20, Math.round(rank)));
}

function blendedLeadRate(): number {
  const c = DEFAULT_ROI_CONFIG;
  return (c.callConversionRate + c.directionConversionRate + c.websiteClickConversionRate) / 3;
}

function modeledRevenueAtRank(
  keyword: string,
  rank: number,
  audit: FullAuditPayload,
  avgCustomerValue: number,
  model: LearnedScoreModel | null
): number {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const impressions = keywordImpressionWeight(keyword, searchKeywords);
  if (impressions <= 0) return 0;

  const clickShare = positionClickShare(rank, model ?? DEFAULT_LEARNED_SCORE_MODEL) / 100;
  const leads = impressions * clickShare * blendedLeadRate();
  return Math.round(leads * avgCustomerValue);
}

function currentRankForKeyword(audit: FullAuditPayload, keyword: string): number {
  const kw = audit.rankings.keywords.find(
    (entry) => entry.keyword.toLowerCase() === keyword.toLowerCase()
  );
  if (!kw) return 10;
  const position = resolveKeywordPosition(kw);
  return position === "not_in_pack" ? 10 : position;
}

/** Estimate monthly revenue delta for a rank change, preferring observed CRM data. */
export function revenueDeltaForRankChange(
  keyword: string,
  fromRank: number,
  toRank: number,
  audit: FullAuditPayload,
  avgCustomerValue: number,
  options?: {
    model?: LearnedScoreModel | null;
    observed?: KeywordRevenueMonthly | null;
    currency?: string;
  }
): RankValueDelta {
  const model = options?.model ?? DEFAULT_LEARNED_SCORE_MODEL;
  const currency = options?.currency ?? "USD";
  const from = clampRank(fromRank);
  const to = clampRank(toRank);

  const modeledAtFrom = modeledRevenueAtRank(keyword, from, audit, avgCustomerValue, model);
  const modeledAtTo = modeledRevenueAtRank(keyword, to, audit, avgCustomerValue, model);
  const modeledDeltaPerMonth = Math.max(0, modeledAtTo - modeledAtFrom);

  let observedDeltaPerMonth: number | null = null;
  let confidence: RankValueDelta["confidence"] = "low";

  const observed = options?.observed;
  if (observed && observed.observedJobs >= MIN_OBSERVED_ACV_SAMPLES && observed.observedRevenue > 0) {
    const observedMonthly = observed.observedRevenue;
    const fromShare = positionClickShare(from, model);
    const toShare = positionClickShare(to, model);
    if (fromShare > 0) {
      observedDeltaPerMonth = Math.round(observedMonthly * ((toShare - fromShare) / fromShare));
      confidence = observed.observedJobs >= 10 ? "high" : "medium";
    }
  } else if (modeledDeltaPerMonth > 0) {
    confidence = "medium";
  }

  const delta = observedDeltaPerMonth ?? modeledDeltaPerMonth;
  const headline =
    delta > 0
      ? `Ranking #${to} instead of #${from} for '${keyword}' is worth ~${formatCurrency(delta, currency)}/mo`
      : `Ranking #${to} instead of #${from} for '${keyword}' shows limited revenue upside`;

  return {
    modeledDeltaPerMonth,
    observedDeltaPerMonth,
    confidence,
    headline,
  };
}

/** Convenience helper using current audit rank as the from-rank. */
export function rankValueHeadlineForKeyword(
  keyword: string,
  toRank: number,
  audit: FullAuditPayload,
  avgCustomerValue: number,
  options?: {
    model?: LearnedScoreModel | null;
    observed?: KeywordRevenueMonthly | null;
    currency?: string;
  }
): RankValueDelta {
  const fromRank = currentRankForKeyword(audit, keyword);
  return revenueDeltaForRankChange(
    keyword,
    fromRank,
    toRank,
    audit,
    avgCustomerValue,
    options
  );
}

/** Rank-1 upside from keyword score cards (modeled baseline). */
export function modeledRank1Upside(
  audit: FullAuditPayload,
  keyword: string,
  avgCustomerValue: number
): number | null {
  const scores = computeKeywordScores(audit, { avgCustomerValue });
  const card = scores.find((entry) => entry.keyword.toLowerCase() === keyword.toLowerCase());
  if (!card?.estimatedMonthlyRevenue || !card.potentialAtRank1) return null;
  return Math.max(0, card.potentialAtRank1 - card.estimatedMonthlyRevenue);
}
