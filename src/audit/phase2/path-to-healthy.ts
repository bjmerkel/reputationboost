import type {
  FullAuditPayload,
  GapFlag,
  PathToHealthy,
  PathToHealthyOptions,
  PathToHealthyStep,
  Plan,
} from "../types";
import { formatCurrency } from "../attribution/roi";
import {
  estimateTotalMonthlyRevenue,
  pickActionsForTarget,
  type ActionRef,
} from "./counterfactual";
import { computeKeywordScores } from "./keyword-scores";
import { estimateStepHealthImpact, gapDriverScoreImpact } from "./score-impact";
import type { AttributionCalibration } from "./attribution-calibration";
import { resolvePathOptimizationMode } from "./path-optimization";
import { computeHealthScores } from "./scoring";

const HEALTHY_THRESHOLD = 70;

export type { PathToHealthyOptions };

function gapToPathStep(
  audit: FullAuditPayload,
  gap: GapFlag,
  index: number
): PathToHealthyStep {
  return {
    id: gap.id,
    title: gap.title,
    scoreImpact: gapDriverScoreImpact(gap, audit),
    source: "gap",
    priority: gap.priority,
    order: index,
    gapId: gap.id,
    keyword: gap.id.startsWith("rank-outside-pack-")
      ? gap.id.replace("rank-outside-pack-", "")
      : undefined,
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

function buildCandidatePool(
  audit: FullAuditPayload,
  plan: Plan | null,
  calibration?: AttributionCalibration
): { steps: PathToHealthyStep[]; actions: ActionRef[] } {
  const gapSteps = (audit.strategy?.gaps ?? [])
    .map((gap, index) => gapToPathStep(audit, gap, index))
    .filter((s) => s.scoreImpact > 0);

  const planPathSteps = plan
    ? plan.steps
        .filter((s) => s.status !== "completed" && s.status !== "skipped")
        .map((s) => ({
          id: `gbp-step-${s.stepNumber}`,
          title: s.title,
          scoreImpact:
            s.context.healthScoreImpact ??
            estimateStepHealthImpact(audit, s.stepNumber, calibration),
          source: "plan" as const,
          order: s.stepNumber,
        }))
        .filter((s) => s.scoreImpact > 0)
    : planStepsToPath(audit, calibration).filter((s) => s.scoreImpact > 0);

  const steps: PathToHealthyStep[] = [...gapSteps];
  const seen = new Set(gapSteps.map((s) => s.id));
  for (const step of planPathSteps) {
    if (!seen.has(step.id)) {
      steps.push(step);
      seen.add(step.id);
    }
  }

  const actions: ActionRef[] = steps.map((step) => ({
    source: step.source,
    id: step.id,
  }));

  return { steps, actions };
}

function formatRevenueLabel(
  amount: number | null | undefined,
  currency: string
): string | null {
  if (amount == null || amount <= 0) return null;
  return `+${formatCurrency(amount, currency)}/mo est.`;
}

function enrichPathStep(
  base: PathToHealthyStep,
  action: {
    marginalDriverGain: number;
    marginalOutcomeGain: number;
    marginalRevenueGain: number | null;
  },
  index: number,
  currency: string
): PathToHealthyStep {
  return {
    ...base,
    scoreImpact: action.marginalDriverGain,
    driverImpact: action.marginalDriverGain,
    outcomeImpact: action.marginalOutcomeGain,
    revenueImpact: action.marginalRevenueGain,
    revenueImpactLabel: formatRevenueLabel(action.marginalRevenueGain, currency),
    order: index,
  };
}

function buildHealthyPathResult(
  audit: FullAuditPayload,
  options: PathToHealthyOptions,
  scores: ReturnType<typeof computeHealthScores>
): PathToHealthy {
  const currency = options.currency ?? "USD";
  const estimatedMonthlyRevenue = estimateTotalMonthlyRevenue(
    audit,
    options.avgCustomerValue
  );

  return {
    targetScore: HEALTHY_THRESHOLD,
    currentScore: scores.overall,
    currentDriverScore: scores.driverScore,
    outcomeIndex: scores.outcomeIndex,
    pointsNeeded: 0,
    projectedScore: scores.overall,
    projectedDriverScore: scores.driverScore,
    projectedOutcomeIndex: scores.outcomeIndex,
    steps: [],
    estimatedRevenueGain: null,
    estimatedRevenueGainLabel: null,
    topKeywords: computeKeywordScores(audit, options).slice(0, 3),
    alreadyHealthy: true,
    optimizationMode: resolvePathOptimizationMode(options, scores),
    estimatedMonthlyRevenue,
    projectedMonthlyRevenue: estimatedMonthlyRevenue,
    currentRevenueCapture: scores.revenueCapture,
    projectedRevenueCapture: scores.revenueCapture,
  };
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
  const currency = options.currency ?? "USD";
  const optimizationMode = resolvePathOptimizationMode(options, {
    driverScore: currentDriverScore,
    outcomeIndex,
  });
  const estimatedMonthlyRevenue = estimateTotalMonthlyRevenue(
    audit,
    options.avgCustomerValue
  );

  if (currentDriverScore >= driverTarget) {
    return buildHealthyPathResult(audit, options, scores);
  }

  const pointsNeeded = driverTarget - currentDriverScore;
  const outcomePointsNeeded = Math.max(0, driverTarget - outcomeIndex);
  const { steps: candidateSteps, actions } = buildCandidatePool(
    audit,
    plan,
    options.calibration
  );
  const stepById = new Map(candidateSteps.map((step) => [step.id, step]));

  const counterfactualOptions = {
    calibration: options.calibration,
    avgCustomerValue: options.avgCustomerValue,
    blendWeights: options.blendWeights,
  };

  const { selected, projection, outcomeProjection } = pickActionsForTarget(
    audit,
    actions,
    {
      mode: optimizationMode,
      driverPointsNeeded: pointsNeeded,
      outcomePointsNeeded,
      revenueGainNeeded: options.targetRevenueGain,
    },
    counterfactualOptions
  );

  const selectedSteps: PathToHealthyStep[] = selected.map((action, index) =>
    enrichPathStep(stepById.get(action.id)!, action, index, currency)
  );

  const revenueGain = outcomeProjection.revenueGain;
  const revenueLabel = formatRevenueLabel(revenueGain, currency);

  return {
    targetScore: driverTarget,
    currentScore,
    currentDriverScore,
    outcomeIndex,
    pointsNeeded,
    projectedScore: projection.projectedOverallScore,
    projectedDriverScore: projection.projectedDriverScore,
    projectedOutcomeIndex: outcomeProjection.projectedOutcomeIndex,
    steps: selectedSteps,
    estimatedRevenueGain: revenueGain,
    estimatedRevenueGainLabel: revenueLabel ? `${revenueLabel} from path actions` : null,
    topKeywords: computeKeywordScores(audit, options).slice(0, 3),
    alreadyHealthy: false,
    optimizationMode,
    estimatedMonthlyRevenue,
    projectedMonthlyRevenue: outcomeProjection.estimatedMonthlyRevenue,
    currentRevenueCapture: scores.revenueCapture,
    projectedRevenueCapture: outcomeProjection.projectedRevenueCapture,
  };
}
