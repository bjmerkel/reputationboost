import type {
  FullAuditPayload,
  GapFlag,
  PathToHealthy,
  PathToHealthyStep,
  Phase1AuditPayload,
  Plan,
} from "../types";
import { formatCurrency } from "../attribution/roi";
import { computeKeywordScores } from "./keyword-scores";
import { estimateStepHealthImpact, gapDriverScoreImpact } from "./score-impact";
import type { AttributionCalibration } from "./attribution-calibration";
import { computeHealthScores } from "./scoring";

const HEALTHY_THRESHOLD = 70;

export interface PathToHealthyOptions {
  avgCustomerValue?: number | null;
  currency?: string;
  calibration?: AttributionCalibration;
}

function gapToPathStep(gap: GapFlag, index: number): PathToHealthyStep {
  return {
    id: gap.id,
    title: gap.title,
    scoreImpact: gapDriverScoreImpact(gap),
    source: "gap",
    priority: gap.priority,
    order: index,
  };
}

function planStepsToPath(
  audit: FullAuditPayload,
  calibration?: AttributionCalibration
): PathToHealthyStep[] {
  const steps = audit.strategy?.gbpPlan?.steps ?? [];
  return steps.map((step, index) => ({
    id: `gbp-step-${step.stepNumber}`,
    title: step.title,
    scoreImpact: estimateStepHealthImpact(audit, step.stepNumber, calibration),
    source: "plan" as const,
    order: index,
  }));
}

function pickStepsToTarget(
  steps: PathToHealthyStep[],
  pointsNeeded: number
): { selected: PathToHealthyStep[]; projectedGain: number } {
  const sorted = [...steps].sort((a, b) => b.scoreImpact - a.scoreImpact);
  const selected: PathToHealthyStep[] = [];
  let gain = 0;

  for (const step of sorted) {
    if (gain >= pointsNeeded) break;
    selected.push(step);
    gain += step.scoreImpact;
  }

  return { selected, projectedGain: gain };
}

function estimateRevenueGain(
  audit: Phase1AuditPayload,
  options: PathToHealthyOptions
): number | null {
  if (!options.avgCustomerValue || options.avgCustomerValue <= 0) return null;

  const keywordCards = computeKeywordScores(audit, {
    avgCustomerValue: options.avgCustomerValue,
    currency: options.currency,
  });

  let gain = 0;
  for (const card of keywordCards.slice(0, 3)) {
    if (card.potentialAtRank1 != null && card.estimatedMonthlyRevenue != null) {
      gain += Math.max(0, card.potentialAtRank1 - card.estimatedMonthlyRevenue);
    }
  }

  return gain > 0 ? gain : null;
}

export function buildPathToHealthy(
  audit: FullAuditPayload,
  plan: Plan | null = null,
  options: PathToHealthyOptions = {}
): PathToHealthy | null {
  const scores = computeHealthScores(audit);
  const currentScore = scores.overall;
  const currentDriverScore = scores.driverScore;
  const outcomeIndex = scores.outcomeIndex;
  const driverTarget = HEALTHY_THRESHOLD;

  if (currentDriverScore >= driverTarget) {
    return {
      targetScore: driverTarget,
      currentScore,
      currentDriverScore,
      outcomeIndex,
      pointsNeeded: 0,
      projectedScore: currentScore,
      projectedDriverScore: currentDriverScore,
      steps: [],
      estimatedRevenueGain: null,
      estimatedRevenueGainLabel: null,
      topKeywords: computeKeywordScores(audit, options).slice(0, 3),
      alreadyHealthy: true,
    };
  }

  const pointsNeeded = driverTarget - currentDriverScore;

  const gapSteps = (audit.strategy?.gaps ?? [])
    .map(gapToPathStep)
    .filter((s) => s.scoreImpact > 0);
  const planPathSteps = plan
    ? plan.steps
        .filter((s) => s.status !== "completed" && s.status !== "skipped")
        .map((s) => ({
          id: `gbp-step-${s.stepNumber}`,
          title: s.title,
          scoreImpact: s.context.healthScoreImpact ?? estimateStepHealthImpact(audit, s.stepNumber, options.calibration),
          source: "plan" as const,
          order: s.stepNumber,
        }))
    : planStepsToPath(audit, options.calibration);

  const combined: PathToHealthyStep[] = [...gapSteps];
  const seen = new Set(gapSteps.map((s) => s.id));
  for (const step of planPathSteps) {
    if (!seen.has(step.id)) {
      combined.push(step);
      seen.add(step.id);
    }
  }
  const { selected, projectedGain } = pickStepsToTarget(combined, pointsNeeded);
  const projectedDriverScore = Math.min(100, currentDriverScore + projectedGain);
  const projectedScore = Math.min(
    100,
    Math.round(currentScore + projectedGain * 0.7)
  );
  const revenueGain = estimateRevenueGain(audit, options);

  return {
    targetScore: driverTarget,
    currentScore,
    currentDriverScore,
    outcomeIndex,
    pointsNeeded,
    projectedScore,
    projectedDriverScore,
    steps: selected.filter((s) => s.scoreImpact > 0),
    estimatedRevenueGain: revenueGain,
    estimatedRevenueGainLabel:
      revenueGain != null
        ? `+${formatCurrency(revenueGain, options.currency ?? "USD")}/mo est. at Healthy`
        : null,
    topKeywords: computeKeywordScores(audit, options).slice(0, 3),
    alreadyHealthy: false,
  };
}
