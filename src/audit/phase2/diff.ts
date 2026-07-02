import type { MonthOverMonthDelta, Phase1AuditPayload } from "../types";
import { computeHealthScores } from "./scoring";

export function computeMonthOverMonth(
  current: Phase1AuditPayload,
  prior: Phase1AuditPayload | null
): MonthOverMonthDelta | null {
  if (!prior) return null;

  const currentScores = computeHealthScores(current);
  const priorScores = computeHealthScores(prior);

  const improvedKeywords: string[] = [];
  const declinedKeywords: string[] = [];

  for (const kw of current.rankings.keywords) {
    const prev = prior.rankings.keywords.find((k) => k.keyword === kw.keyword);
    if (!prev) continue;

    const curPos = typeof kw.localPackPosition === "number" ? kw.localPackPosition : 20;
    const prevPos =
      typeof prev.localPackPosition === "number" ? prev.localPackPosition : 20;

    if (curPos < prevPos) improvedKeywords.push(kw.keyword);
    if (curPos > prevPos) declinedKeywords.push(kw.keyword);
  }

  return {
    keywordsInPackChange:
      current.rankings.keywordsInPack - prior.rankings.keywordsInPack,
    reviewCountChange:
      current.gbp.engagement.reviewCount - prior.gbp.engagement.reviewCount,
    callsChange: current.gbp.performance.calls - prior.gbp.performance.calls,
    directionRequestsChange:
      current.gbp.performance.directionRequests -
      prior.gbp.performance.directionRequests,
    shareOfVoiceChange:
      current.rankings.shareOfVoice - prior.rankings.shareOfVoice,
    overallScoreChange: currentScores.overall - priorScores.overall,
    improvedKeywords,
    declinedKeywords,
  };
}
