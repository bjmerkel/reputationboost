import type {
  FullAuditPayload,
  GapFlag,
  PathToHealthy,
  PathToHealthyStep,
  Phase1AuditPayload,
  Plan,
} from "../types";
import { formatCurrency } from "../attribution/roi";
import { pickActionsForDriverTarget, projectOutcomeScoresFromActions, type ActionRef } from "./counterfactual";
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

function estimateRevenueGainFromActions(
  audit: Phase1AuditPayload,
  actions: ActionRef[],
  options: PathToHealthyOptions
): number | null {
  if (!options.avgCustomerValue || options.avgCustomerValue <= 0) return null;

  const projection = projectOutcomeScoresFromActions(audit, actions, {
    avgCustomerValue: options.avgCustomerValue,
    calibration: options.calibration,
  });

  return projection.revenueGain;
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
      projectedOutcomeIndex: outcomeIndex,
      steps: [],
      estimatedRevenueGain: null,
      estimatedRevenueGainLabel: null,
      topKeywords: computeKeywordScores(audit, options).slice(0, 3),
      alreadyHealthy: true,
    };
  }

  const pointsNeeded = driverTarget - currentDriverScore;
  const { steps: candidateSteps, actions } = buildCandidatePool(
    audit,
    plan,
    options.calibration
  );
  const stepById = new Map(candidateSteps.map((step) => [step.id, step]));

  const { selected, projection } = pickActionsForDriverTarget(
    audit,
    actions,
    pointsNeeded,
    {
      calibration: options.calibration,
      avgCustomerValue: options.avgCustomerValue,
    }
  );

  const outcomeProjection = projectOutcomeScoresFromActions(audit, selected, {
    calibration: options.calibration,
    avgCustomerValue: options.avgCustomerValue,
  });

  const selectedSteps: PathToHealthyStep[] = selected.map((action, index) => {
    const base = stepById.get(action.id)!;
    return {
      ...base,
      scoreImpact: action.marginalDriverGain,
      order: index,
    };
  });

  const revenueGain = estimateRevenueGainFromActions(audit, selected, options);

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
    estimatedRevenueGainLabel:
      revenueGain != null
        ? `+${formatCurrency(revenueGain, options.currency ?? "USD")}/mo est. from path actions`
        : null,
    topKeywords: computeKeywordScores(audit, options).slice(0, 3),
    alreadyHealthy: false,
  };
}
