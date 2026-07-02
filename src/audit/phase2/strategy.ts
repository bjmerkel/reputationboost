import type {
  ActionItem,
  GapFlag,
  HealthScores,
  MonthOverMonthDelta,
  Phase1AuditPayload,
  StrategyReport,
} from "../types";
import { detectGaps } from "./gaps";
import { computeMonthOverMonth } from "./diff";
import { computeHealthScores } from "./scoring";

function gapToAction(gap: GapFlag, index: number): ActionItem {
  const dueDays =
    gap.priority === "P0" ? 3 : gap.priority === "P1" ? 7 : gap.priority === "P2" ? 14 : 30;

  const owner: ActionItem["owner"] =
    gap.category === "reviews" && gap.id.includes("unresponded")
      ? "account_manager"
      : gap.category === "content" || gap.category === "social"
        ? "system"
        : "client";

  const draftCopy = buildDraftCopy(gap);

  return {
    id: `action-${index + 1}`,
    priority: gap.priority,
    category: gap.category,
    title: gap.title,
    description: gap.description,
    owner,
    dueDays,
    expectedImpact: `Impact ${gap.impact}/10 · Effort ${gap.effort}/10`,
    draftCopy,
  };
}

function buildDraftCopy(gap: GapFlag): string | undefined {
  if (gap.id.startsWith("rank-outside-pack")) {
    const keyword = gap.id.replace("rank-outside-pack-", "");
    return `Focus optimization on "${keyword}": strengthen GBP description with this service, collect 5+ reviews mentioning it, and publish 2 Google Posts targeting local searchers.`;
  }
  if (gap.id === "unresponded-negative") {
    return `"Thank you for your feedback. We're sorry your experience didn't meet expectations. We'd like to make this right — please call us at [PHONE] so we can resolve this personally."`;
  }
  if (gap.id === "stale-posts") {
    return `Google Post draft: "Looking for [SERVICE] in [CITY]? We're your local experts with [X]+ 5-star reviews. Call today for a free estimate!"`;
  }
  if (gap.id === "review-gap") {
    return `Send review requests to 15 recent customers via text/email survey. Target 8 new Google reviews this month.`;
  }
  return undefined;
}

function buildExecutiveSummary(
  audit: Phase1AuditPayload,
  scores: HealthScores,
  gaps: GapFlag[],
  mom: MonthOverMonthDelta | null
): string {
  const packPct = audit.rankings.shareOfVoice;
  const p0Count = gaps.filter((g) => g.priority === "P0").length;

  let summary = `${audit.clientName} scores ${scores.overall}/100 (${scores.grade.replace("_", " ")}). `;
  summary += `You're in the Local 3-Pack for ${audit.rankings.keywordsInPack} of ${audit.rankings.totalKeywords} keywords (${packPct}% share of voice). `;

  if (mom && mom.keywordsInPackChange > 0) {
    summary += `Up ${mom.keywordsInPackChange} keyword(s) in the pack since last audit. `;
  } else if (mom && mom.keywordsInPackChange < 0) {
    summary += `Down ${Math.abs(mom.keywordsInPackChange)} keyword(s) in the pack since last audit — act now. `;
  }

  if (p0Count > 0) {
    summary += `${p0Count} urgent issue(s) need attention this week to recover map visibility.`;
  } else {
    summary += `Focus on the prioritized 30-day plan below to capture more of the 70%+ of map clicks going to the top 3.`;
  }

  return summary;
}

function buildBiggestThreat(audit: Phase1AuditPayload, gaps: GapFlag[]): string {
  const topGap = gaps[0];
  if (topGap) return topGap.description;

  const outside = audit.rankings.keywords.filter((k) => !k.inLocalPack);
  if (outside.length > 0) {
    return `Missing the Local 3-Pack on ${outside.length} keywords — competitors capture the majority of clicks.`;
  }

  return "Maintain momentum with consistent posts, reviews, and profile updates.";
}

function buildBiggestWin(mom: MonthOverMonthDelta | null): string | null {
  if (!mom) return null;
  if (mom.improvedKeywords.length > 0) {
    return `Improved rankings on: ${mom.improvedKeywords.join(", ")}`;
  }
  if (mom.callsChange > 0) {
    return `Calls up ${mom.callsChange} vs. last month — visibility is converting.`;
  }
  if (mom.reviewCountChange > 0) {
    return `Gained ${mom.reviewCountChange} new reviews since last audit.`;
  }
  return null;
}

function buildKpiTargets(audit: Phase1AuditPayload, gaps: GapFlag[]): string[] {
  const targets: string[] = [];

  const outsideCount = audit.rankings.keywords.filter((k) => !k.inLocalPack).length;
  if (outsideCount > 0) {
    targets.push(`Enter Local 3-Pack on ${Math.min(2, outsideCount)} additional keyword(s)`);
  }

  targets.push(`Collect ${Math.max(5, 8 - audit.gbp.engagement.reviewsLast30Days)} new Google reviews`);
  targets.push("Publish 4 Google Posts this month");

  if (gaps.some((g) => g.id === "unresponded-negative")) {
    targets.push("Respond to all negative reviews within 24 hours");
  }

  targets.push(
    `Reach ${Math.min(100, audit.rankings.shareOfVoice + 20)}% share of voice across target keywords`
  );

  return targets.slice(0, 5);
}

export function buildStrategy(
  audit: Phase1AuditPayload,
  priorAudit: Phase1AuditPayload | null = null
): StrategyReport {
  const scores = computeHealthScores(audit);
  const gaps = detectGaps(audit);
  const mom = computeMonthOverMonth(audit, priorAudit);
  const actionPlan = gaps.slice(0, 12).map(gapToAction);

  const localPackStatus = `In the Local 3-Pack for ${audit.rankings.keywordsInPack} of ${audit.rankings.totalKeywords} target keywords (${audit.rankings.shareOfVoice}% share of voice).`;

  return {
    generatedAt: new Date().toISOString(),
    executiveSummary: buildExecutiveSummary(audit, scores, gaps, mom),
    biggestWin: buildBiggestWin(mom),
    biggestThreat: buildBiggestThreat(audit, gaps),
    localPackStatus,
    kpiTargets: buildKpiTargets(audit, gaps),
    scores,
    gaps,
    actionPlan,
    monthOverMonth: mom,
  };
}
