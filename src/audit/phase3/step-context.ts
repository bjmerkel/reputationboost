import type { FullAuditPayload, GbpPlanStep, PlanStepContext } from "../types";
import type { AttributionCalibration } from "../phase2/attribution-calibration";
import { keywordsMissingFromText } from "@/audit/attribution/keywords";
import { estimateStepHealthImpact, estimateStepOutcomeImpact, estimateStepRevenueImpact } from "../phase2/score-impact";
import { isCustomPlanStep } from "./plan-custom-steps";

/** Mirrors counterfactual step-3 satisfaction threshold. */
const DESCRIPTION_MIN_LENGTH = 400;

const DESCRIPTION_RECOMMENDED_PLACEHOLDER =
  "Updated description below — includes all target keywords";

function targetKeywords(audit: FullAuditPayload, step: GbpPlanStep): string[] {
  const fromPlan = audit.strategy.gbpPlan?.targetKeywords ?? [];
  if (fromPlan.length > 0) return fromPlan;
  return audit.rankings.keywords.map((k) => k.keyword);
}

function keywordsOutsidePack(audit: FullAuditPayload): string[] {
  const rankings = audit.strategy.gbpPlan?.keywordRankings ?? [];
  return rankings.filter((r) => !r.inLocalPack).map((r) => r.keyword);
}

function liveDescription(audit: FullAuditPayload): string {
  return audit.gbp.liveProfile?.description?.trim() ?? "";
}

function formatKeywordExamples(keywords: string[]): string {
  return keywords
    .slice(0, 2)
    .map((keyword) => `"${keyword}"`)
    .join(" and ");
}

function buildDescriptionExpectedEffect(
  audit: FullAuditPayload,
  keywords: string[]
): string {
  const current = liveDescription(audit);
  const missing = keywordsMissingFromText(current, keywords);
  const rankings = audit.strategy.gbpPlan?.keywordRankings ?? [];

  if (!current) {
    return "Add a business description that weaves in your target keywords and local trust signals.";
  }

  if (current.length < DESCRIPTION_MIN_LENGTH) {
    if (missing.length > 0) {
      const examples = formatKeywordExamples(missing);
      return `Your description is ${current.length} characters — expand it while adding keywords like ${examples}.`;
    }
    return `Expand your description from ${current.length} to ${DESCRIPTION_MIN_LENGTH}+ characters with trust signals and local details.`;
  }

  if (missing.length === 0) {
    return "Your description already covers your target keywords — refine wording to emphasize terms where you're outside the 3-Pack.";
  }

  if (missing.length <= 2) {
    const examples = formatKeywordExamples(missing);
    return `Almost there — weave in ${missing.length === 1 ? "one more target keyword" : "a couple more target keywords"} like ${examples} to match competitors.`;
  }

  const outsideMissing = missing.filter((keyword) => {
    const ranking = rankings.find((row) => row.keyword.toLowerCase() === keyword.toLowerCase());
    return ranking ? !ranking.inLocalPack : true;
  });
  const priorityMissing = outsideMissing.length > 0 ? outsideMissing : missing;
  const examples = formatKeywordExamples(priorityMissing);

  return `Your description doesn't cover ${missing.length} of ${keywords.length} target keywords${examples ? ` (e.g. ${examples})` : ""}; competitors ranking above you include them.`;
}

function resolveCurrentDescriptionValue(
  audit: FullAuditPayload,
  step: GbpPlanStep
): string | undefined {
  const live = liveDescription(audit);
  if (live) return live;

  const current = step.current?.trim();
  if (!current) return undefined;

  const templateMatch = current.match(/^\d+ characters:\s*"([\s\S]*)"$'/);
  if (templateMatch) {
    const parsed = templateMatch[1].replace(/…$/, "").trim();
    return parsed || current;
  }

  return current;
}

function resolveRecommendedDescriptionValue(step: GbpPlanStep): string | undefined {
  const fromAction = step.actionData?.description?.trim();
  if (fromAction) return fromAction;

  const fromCopyBlock = step.copyBlocks?.[0]?.content?.trim();
  if (fromCopyBlock) return fromCopyBlock;

  const recommended = step.recommended?.trim();
  if (recommended && recommended !== DESCRIPTION_RECOMMENDED_PLACEHOLDER) {
    return recommended;
  }

  return recommended || fromCopyBlock;
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
    case 3:
      return buildDescriptionExpectedEffect(audit, keywords);
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
    case 13: {
      const coverage = audit.gbp.attributeCoverage;
      if (!coverage || coverage.availableCount === 0) {
        return audit.gbp.completeness.attributeCount < 5
          ? `Only ${audit.gbp.completeness.attributeCount} attributes enabled — add at least 5 to strengthen profile completeness.`
          : "Enable applicable attributes to strengthen relevance and trust signals.";
      }
      if (coverage.missingCount === 0) {
        return `All ${coverage.availableCount} available attributes are enabled on your profile.`;
      }
      const autoCount = coverage.missing.filter((item) => item.autoApplicable).length;
      const manualCount = coverage.missing.length - autoCount;
      if (autoCount > 0 && manualCount > 0) {
        return `Your profile is missing ${coverage.missingCount} of ${coverage.availableCount} available attributes — approve ${autoCount} now and set ${manualCount} manually in Google to improve your Reputation Boost Score.`;
      }
      if (manualCount > 0) {
        return `Your profile is missing ${manualCount} attribute${manualCount === 1 ? "" : "s"} that must be set manually in Google Business Profile.`;
      }
      return `Your profile is missing ${coverage.missingCount} of ${coverage.availableCount} available attributes — enabling them improves completeness and your Reputation Boost Score.`;
    }
    case 14:
      return "Enable messaging and respond quickly to increase engagement signals.";
    case 15:
      return "Enable online booking to create conversion signals inside Google.";
    case 16:
      return "Execute the weekly cadence consistently to move keywords into the Top 3.";
    default:
      if (isCustomPlanStep(step.stepNumber)) {
        return step.instruction.includes("Why this step:")
          ? step.instruction.split("\n\nWhy this step:")[1]?.trim() ?? step.instruction
          : step.instruction;
      }
      return step.instruction.split(".")[0] + ".";
  }
}

export function buildStepContext(
  audit: FullAuditPayload,
  step: GbpPlanStep,
  calibration?: AttributionCalibration,
  avgCustomerValue?: number | null
): PlanStepContext {
  const keywords = targetKeywords(audit, step);
  const outsidePack = keywordsOutsidePack(audit);
  const primaryKeyword =
    outsidePack[0] ?? keywords[0] ?? audit.strategy.gbpPlan?.keywordPriority?.[0]?.keyword;

  const isCustom = isCustomPlanStep(step.stepNumber);

  return {
    targetKeywords: keywords,
    primaryKeyword,
    expectedEffect: buildExpectedEffect(audit, step),
    currentValue:
      step.stepNumber === 3
        ? resolveCurrentDescriptionValue(audit, step)
        : step.current,
    recommendedValue:
      step.stepNumber === 3
        ? resolveRecommendedDescriptionValue(step)
        : step.recommended,
    healthScoreImpact: isCustom
      ? undefined
      : estimateStepHealthImpact(audit, step.stepNumber, calibration),
    outcomeScoreImpact: isCustom
      ? undefined
      : estimateStepOutcomeImpact(audit, step.stepNumber),
    revenueImpact: isCustom
      ? null
      : estimateStepRevenueImpact(audit, step.stepNumber, avgCustomerValue),
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
    ...(context.healthScoreImpact != null
      ? { projectedDriverImpact: context.healthScoreImpact }
      : {}),
    ...(context.outcomeScoreImpact != null
      ? { projectedOutcomeImpact: context.outcomeScoreImpact }
      : {}),
    ...(context.revenueImpact != null && context.revenueImpact > 0
      ? { projectedRevenueGain: context.revenueImpact, revenueImpact: context.revenueImpact }
      : {}),
    ...(isCustomPlanStep(step.stepNumber) ? { isCustomPlanStep: true } : {}),
  };
}
