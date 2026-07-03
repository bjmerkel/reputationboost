import type {
  CompetitorDelta,
  MonthOverMonthDelta,
  Phase1AuditPayload,
  RankMovement,
} from "../types";
import { computeHealthScores } from "./scoring";

function rankAt1Mi(keyword: { geoRanks: { distanceMiles: number; rank: number | null }[] }): number | null {
  return keyword.geoRanks.find((g) => g.distanceMiles === 1)?.rank ?? null;
}

function formatPosition(rank: number | null): string {
  if (rank === null) return "not ranked";
  if (rank > 20) return "#20+";
  return `#${rank}`;
}

export function buildRankMovements(
  current: Phase1AuditPayload,
  prior: Phase1AuditPayload
): RankMovement[] {
  const movements: RankMovement[] = [];

  for (const kw of current.rankings.keywords) {
    const prev = prior.rankings.keywords.find((k) => k.keyword === kw.keyword);
    if (!prev) continue;

    const toPosition = rankAt1Mi(kw);
    const fromPosition = rankAt1Mi(prev);
    if (toPosition === fromPosition) continue;

    const curRank = toPosition ?? 99;
    const prevRank = fromPosition ?? 99;

    movements.push({
      keyword: kw.keyword,
      fromPosition,
      toPosition,
      improved: curRank < prevRank,
    });
  }

  return movements.sort((a, b) => {
    const aDelta = (a.fromPosition ?? 99) - (a.toPosition ?? 99);
    const bDelta = (b.fromPosition ?? 99) - (b.toPosition ?? 99);
    return bDelta - aDelta;
  });
}

export function buildCompetitorDeltas(
  current: Phase1AuditPayload,
  prior: Phase1AuditPayload
): CompetitorDelta[] {
  const clientReviewGain =
    current.gbp.engagement.reviewCount - prior.gbp.engagement.reviewCount;

  const priorByPlaceId = new Map<string, number>();
  for (const snap of prior.competitors) {
    for (const c of snap.competitors) {
      const existing = priorByPlaceId.get(c.placeId) ?? 0;
      priorByPlaceId.set(c.placeId, Math.max(existing, c.reviewCount));
    }
  }

  const currentCompetitors = new Map<
    string,
    { name: string; reviewCount: number; appearances: number }
  >();

  for (const snap of current.competitors) {
    for (const c of snap.competitors) {
      const existing = currentCompetitors.get(c.placeId);
      if (!existing || c.reviewCount > existing.reviewCount) {
        currentCompetitors.set(c.placeId, {
          name: c.name,
          reviewCount: c.reviewCount,
          appearances: (existing?.appearances ?? 0) + 1,
        });
      } else if (existing) {
        existing.appearances += 1;
      }
    }
  }

  const deltas: CompetitorDelta[] = [];

  for (const [placeId, comp] of currentCompetitors) {
    const priorReviews = priorByPlaceId.get(placeId);
    if (priorReviews === undefined) continue;

    const competitorReviewGain = comp.reviewCount - priorReviews;
    if (competitorReviewGain === 0 && clientReviewGain === 0) continue;

    deltas.push({
      competitorName: comp.name,
      competitorReviewGain,
      clientReviewGain,
    });
  }

  return deltas
    .sort(
      (a, b) =>
        Math.abs(b.competitorReviewGain) + Math.abs(b.clientReviewGain) -
        (Math.abs(a.competitorReviewGain) + Math.abs(a.clientReviewGain))
    )
    .slice(0, 3);
}

export function describeRankMovement(movement: RankMovement): string {
  const from = formatPosition(movement.fromPosition);
  const to = formatPosition(movement.toPosition);

  if (movement.fromPosition === null && movement.toPosition !== null) {
    return `Currently ${to} on "${movement.keyword}"`;
  }

  if (movement.improved) {
    return `You moved from ${from} → ${to} on "${movement.keyword}"`;
  }
  return `You dropped from ${from} → ${to} on "${movement.keyword}"`;
}

export function describeCompetitorDelta(delta: CompetitorDelta): string {
  const compGain =
    delta.competitorReviewGain >= 0
      ? `gained ${delta.competitorReviewGain}`
      : `lost ${Math.abs(delta.competitorReviewGain)}`;
  const clientGain =
    delta.clientReviewGain >= 0
      ? `you gained ${delta.clientReviewGain}`
      : `you lost ${Math.abs(delta.clientReviewGain)}`;
  return `${delta.competitorName} ${compGain} reviews; ${clientGain}`;
}

function metricDelta(current: number, prior: number) {
  const change = current - prior;
  const changePercent =
    prior > 0 ? Math.round((change / prior) * 100) : current > 0 ? 100 : null;
  return { current, prior, change, changePercent };
}

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

    const curPos = rankAt1Mi(kw) ?? 99;
    const prevPos = rankAt1Mi(prev) ?? 99;

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
    websiteClicksChange:
      current.gbp.performance.websiteClicks - prior.gbp.performance.websiteClicks,
    shareOfVoiceChange:
      current.rankings.shareOfVoice - prior.rankings.shareOfVoice,
    overallScoreChange: currentScores.overall - priorScores.overall,
    visibilityScoreChange: currentScores.visibility - priorScores.visibility,
    conversionScoreChange: currentScores.conversion - priorScores.conversion,
    revenueCaptureScoreChange:
      currentScores.revenueCapture - priorScores.revenueCapture,
    improvedKeywords,
    declinedKeywords,
    rankMovements: buildRankMovements(current, prior),
    competitorDeltas: buildCompetitorDeltas(current, prior),
  };
}
