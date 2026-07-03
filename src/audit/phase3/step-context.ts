import type { FullAuditPayload, GbpPlanStep, PlanStepContext } from "../types";

function targetKeywords(audit: FullAuditPayload, step: GbpPlanStep): string[] {
  const fromPlan = audit.strategy.gbpPlan?.targetKeywords ?? [];
  if (fromPlan.length > 0) return fromPlan;
  return audit.rankings.keywords.map((k) => k.keyword);
}

function keywordsOutsidePack(audit: FullAuditPayload): string[] {
  const rankings = audit.strategy.gbpPlan?.keywordRankings ?? [];
  return rankings.filter((r) => !r.inLocalPack).map((r) => r.keyword);
}

function missingKeywordsInText(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => !lower.includes(kw.toLowerCase()));
}

function buildExpectedEffect(audit: FullAuditPayload, step: GbpPlanStep): string {
  const keywords = targetKeywords(audit, step);
  const outsidePack = keywordsOutsidePack(audit);
  const rankings = audit.strategy.gbpPlan?.keywordRankings ?? [];

  switch (step.stepNumber) {
    case 1:
      return "Align your primary category with top revenue keywords for stronger Maps relevance.";
    case 2:
      return outsidePack.length > 0
        ? `Expand category coverage for related searches like "${outsidePack.slice(0, 2).join('", "')}".`
        : "Add secondary categories that match services you actively offer.";
    case 3: {
      const draft =
        step.recommended ??
        step.copyBlocks?.[0]?.content ??
        audit.gbp.liveProfile?.description ??
        "";
      const missing = missingKeywordsInText(draft, keywords);
      if (missing.length > 0) {
        return `Your description doesn't mention ${missing.length} of ${keywords.length} target keywords; competitors ranking above you include them.`;
      }
      return "Strengthen keyword coverage in your business description.";
    }
    case 4:
      return "Add dedicated GBP services for keywords you're not yet ranking for.";
    case 5:
      return outsidePack.length > 0
        ? `Create products for keywords outside the 3-Pack: "${outsidePack.slice(0, 2).join('", "')}".`
        : "Reinforce relevance with product listings for core services.";
    case 6:
      return `Increase photo count to compete with pack leaders and improve engagement signals.`;
    case 7:
      return "Upload short videos to boost profile engagement and trust.";
    case 8:
      return outsidePack.length > 0
        ? `Publish weekly posts targeting keywords outside the 3-Pack, starting with "${outsidePack[0]}".`
        : "Maintain weekly Google Posts to signal an active profile.";
    case 9:
      return "Seed Q&A pairs covering target keywords and answer all unanswered questions.";
    case 10: {
      const gaps = rankings.filter((r) => r.reviewGap > 20);
      if (gaps.length > 0) {
        return `Close review-count gaps on "${gaps[0].keyword}" (${gaps[0].reviewGap} behind the pack leader).`;
      }
      return "Grow review volume with keyword-rich natural language from customers.";
    }
    case 11:
      return audit.reviews.unrespondedNegative > 0
        ? `Respond to ${audit.reviews.unrespondedNegative} unresponded negative review(s) within 24 hours.`
        : "Maintain 100% review response rate with keyword-aware replies.";
    case 12:
      return "Keep hours accurate — inconsistent hours hurt rankings and customer trust.";
    case 13:
      return "Enable applicable attributes to strengthen relevance and trust signals.";
    case 14:
      return "Enable messaging and respond quickly to increase engagement signals.";
    case 15:
      return "Enable online booking to create conversion signals inside Google.";
    case 16:
      return "Execute the weekly cadence consistently to move keywords into the Top 3.";
    default:
      return step.instruction.split(".")[0] + ".";
  }
}

export function buildStepContext(audit: FullAuditPayload, step: GbpPlanStep): PlanStepContext {
  const keywords = targetKeywords(audit, step);
  const outsidePack = keywordsOutsidePack(audit);
  const primaryKeyword =
    outsidePack[0] ?? keywords[0] ?? audit.strategy.gbpPlan?.keywordPriority?.[0]?.keyword;

  return {
    targetKeywords: keywords,
    primaryKeyword,
    expectedEffect: buildExpectedEffect(audit, step),
    currentValue: step.current,
    recommendedValue: step.recommended,
  };
}

export function buildTaskPayloadContext(
  audit: FullAuditPayload,
  step: GbpPlanStep
): Record<string, unknown> {
  const context = buildStepContext(audit, step);
  return {
    targetKeywords: context.targetKeywords,
    primaryKeyword: context.primaryKeyword,
    expectedEffect: context.expectedEffect,
    currentValue: context.currentValue,
    recommendedValue: context.recommendedValue,
  };
}
