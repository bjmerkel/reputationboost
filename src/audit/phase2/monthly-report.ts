import type {
  ActionItem,
  MonthlyReport,
  MonthOverMonthDelta,
  Phase1AuditPayload,
  StrategyReport,
} from "../types";
import { describeCompetitorDelta, describeRankMovement } from "./diff";

function metricDelta(current: number, prior: number) {
  const change = current - prior;
  const changePercent =
    prior > 0 ? Math.round((change / prior) * 100) : current > 0 ? 100 : null;
  return { current, prior, change, changePercent };
}

function buildHeadline(audit: Phase1AuditPayload, mom: MonthOverMonthDelta): string {
  const bestMove = mom.rankMovements.find((m) => m.improved);
  if (bestMove) {
    return describeRankMovement(bestMove);
  }

  if (mom.callsChange > 0) {
    return `Calls up ${mom.callsChange} vs. last month — your visibility is converting.`;
  }

  if (mom.reviewCountChange > 0) {
    return `You gained ${mom.reviewCountChange} new reviews since last month.`;
  }

  if (mom.overallScoreChange > 0) {
    return `Health score improved ${mom.overallScoreChange} points — momentum is building.`;
  }

  const outside = audit.rankings.keywords.filter((k) => !k.inLocalPack).length;
  if (outside > 0) {
    return `${outside} keyword(s) still outside the Local 3-Pack — the plan below targets the highest-impact fixes.`;
  }

  return `Solid month for ${audit.clientName}. Execute the top 5 actions below to widen your lead.`;
}

function topActionsByImpact(actionPlan: ActionItem[]): ActionItem[] {
  const priorityWeight = { P0: 4, P1: 3, P2: 2, P3: 1 };

  return [...actionPlan]
    .sort((a, b) => {
      const pw = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (pw !== 0) return pw;
      return a.dueDays - b.dueDays;
    })
    .slice(0, 5);
}

export function buildMonthlyReport(
  audit: Phase1AuditPayload,
  priorAudit: Phase1AuditPayload | null,
  strategy: StrategyReport
): MonthlyReport | null {
  const mom = strategy.monthOverMonth;
  if (!mom || !priorAudit) return null;

  return {
    generatedAt: new Date().toISOString(),
    hasPriorPeriod: true,
    priorPeriod: priorAudit.period,
    headline: buildHeadline(audit, mom),
    rankMovements: mom.rankMovements,
    engagement: {
      calls: metricDelta(
        audit.gbp.performance.calls,
        priorAudit.gbp.performance.calls
      ),
      directions: metricDelta(
        audit.gbp.performance.directionRequests,
        priorAudit.gbp.performance.directionRequests
      ),
      websiteClicks: metricDelta(
        audit.gbp.performance.websiteClicks,
        priorAudit.gbp.performance.websiteClicks
      ),
    },
    competitorDeltas: mom.competitorDeltas.map((d) => ({
      ...d,
    })),
    nextMonthPlan: topActionsByImpact(strategy.actionPlan),
    contentSource: strategy.contentSource,
  };
}

export function buildFirstAuditReport(
  audit: Phase1AuditPayload,
  strategy: StrategyReport
): MonthlyReport {
  return {
    generatedAt: new Date().toISOString(),
    hasPriorPeriod: false,
    priorPeriod: null,
    headline: `Baseline audit for ${audit.clientName} — your first automated report. Re-run next month for before/after comparisons.`,
    rankMovements: audit.rankings.keywords.map((kw) => ({
      keyword: kw.keyword,
      fromPosition: null,
      toPosition: kw.geoRanks.find((g) => g.distanceMiles === 1)?.rank ?? null,
      improved: false,
    })),
    engagement: {
      calls: metricDelta(audit.gbp.performance.calls, 0),
      directions: metricDelta(audit.gbp.performance.directionRequests, 0),
      websiteClicks: metricDelta(audit.gbp.performance.websiteClicks, 0),
    },
    competitorDeltas: audit.competitors
      .flatMap((s) => s.competitors.slice(0, 1))
      .slice(0, 2)
      .map((c) => ({
        competitorName: c.name,
        competitorReviewGain: 0,
        clientReviewGain: audit.gbp.engagement.reviewsLast30Days,
      })),
    nextMonthPlan: topActionsByImpact(strategy.actionPlan),
    contentSource: strategy.contentSource,
  };
}

export { describeCompetitorDelta, describeRankMovement };
