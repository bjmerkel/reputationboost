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
  estimateTotalMonthlyLeads,
  estimateTotalMonthlyRevenue,
  pickActionsForTarget,
  simulateActionMarginalImpact,
  type ActionRef,
} from "./counterfactual";
import { computeKeywordScores } from "./keyword-scores";
import {
  estimateStepHealthImpact,
  gapCandidateSortScore,
  gapDriverScoreImpact,
  gapOutcomeScoreImpact,
  gapQualifiesForPool,
  gapRevenueImpact,
} from "./score-impact";
import {
  resolveCalibrationConfidence,
  type AttributionCalibration,
  type GapAttributionCalibration,
} from "./attribution-calibration";
import {
  compositeMarginalScore,
  resolveBlendWeights,
  resolvePathOptimizationMode,
} from "./path-optimization";
import { computeHealthScores, impressionWeightFloor, keywordImpressionWeight } from "./scoring";

const HEALTHY_THRESHOLD = 70;

const PRIORITY_ORDER: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export type { PathToHealthyOptions };

interface PoolCandidate extends PathToHealthyStep {
  sortScore: number;
  impressionWeight: number;
}

function priorityRank(priority?: string): number {
  return PRIORITY_ORDER[priority ?? "P3"] ?? 9;
}

function gapToPoolCandidate(
  audit: FullAuditPayload,
  gap: GapFlag,
  index: number,
  options: PathToHealthyOptions
): PoolCandidate {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const floor = impressionWeightFloor(searchKeywords);
  const keyword =
    gap.id.startsWith("rank-outside-pack-") || gap.id.startsWith("pack-fragility-")
      ? gap.id.replace(/^rank-outside-pack-|^pack-fragility-/, "")
      : undefined;
  const driver = gapDriverScoreImpact(gap, audit);
  const outcome = gapOutcomeScoreImpact(gap, audit);
  const revenue = gapRevenueImpact(gap, audit, options.avgCustomerValue);

  return {
    id: gap.id,
    title: gap.title,
    scoreImpact: driver > 0 ? driver : Math.max(outcome, revenue ?? 0),
    source: "gap",
    priority: gap.priority,
    order: index,
    gapId: gap.id,
    keyword,
    driverImpact: driver,
    outcomeImpact: outcome,
    revenueImpact: revenue,
    sortScore: gapCandidateSortScore(
      gap,
      audit,
      options.avgCustomerValue,
      options.blendWeights
    ),
    impressionWeight: keyword
      ? keywordImpressionWeight(keyword, searchKeywords, floor)
      : gap.impactScore,
  };
}

function planToPoolCandidate(
  audit: FullAuditPayload,
  step: {
    id: string;
    title: string;
    scoreImpact: number;
    order: number;
  },
  options: PathToHealthyOptions
): PoolCandidate {
  const action: ActionRef = { source: "plan", id: step.id };
  const impact = simulateActionMarginalImpact(audit, [], action, {
    avgCustomerValue: options.avgCustomerValue,
    calibration: options.calibration,
  });
  const weights = resolveBlendWeights(options.avgCustomerValue, options.blendWeights);

  return {
    id: step.id,
    title: step.title,
    scoreImpact: step.scoreImpact,
    source: "plan",
    order: step.order,
    driverImpact: impact.driverGain,
    outcomeImpact: impact.outcomeGain,
    revenueImpact: impact.revenueGain,
    sortScore: compositeMarginalScore(impact, weights),
    impressionWeight: step.scoreImpact,
  };
}

function sortPoolCandidates(candidates: PoolCandidate[]): PoolCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
    const priDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priDiff !== 0) return priDiff;
    return b.impressionWeight - a.impressionWeight;
  });
}

function buildCandidatePool(
  audit: FullAuditPayload,
  plan: Plan | null,
  options: PathToHealthyOptions
): { steps: PathToHealthyStep[]; actions: ActionRef[] } {
  const calibration = options.calibration;

  const gapSteps = (audit.strategy?.gaps ?? [])
    .filter((gap) => gapQualifiesForPool(gap, audit, options.avgCustomerValue))
    .map((gap, index) => gapToPoolCandidate(audit, gap, index, options));

  const planPathSteps = plan
    ? plan.steps
        .filter((s) => s.status !== "completed" && s.status !== "skipped")
        .map((s) =>
          planToPoolCandidate(
            audit,
            {
              id: `gbp-step-${s.stepNumber}`,
              title: s.title,
              scoreImpact:
                s.context.healthScoreImpact ??
                estimateStepHealthImpact(audit, s.stepNumber, calibration),
              order: s.stepNumber,
            },
            options
          )
        )
        .filter(
          (s) =>
            s.sortScore > 0 ||
            (s.driverImpact ?? 0) > 0 ||
            (s.outcomeImpact ?? 0) > 0 ||
            (s.revenueImpact ?? 0) > 0
        )
    : (audit.strategy?.gbpPlan?.steps ?? [])
        .map((step, index) =>
          planToPoolCandidate(
            audit,
            {
              id: `gbp-step-${step.stepNumber}`,
              title: step.title,
              scoreImpact: estimateStepHealthImpact(audit, step.stepNumber, calibration),
              order: index,
            },
            options
          )
        )
        .filter(
          (s) =>
            s.sortScore > 0 ||
            (s.driverImpact ?? 0) > 0 ||
            (s.outcomeImpact ?? 0) > 0 ||
            (s.revenueImpact ?? 0) > 0
        );

  const merged: PoolCandidate[] = [...gapSteps];
  const seen = new Set(gapSteps.map((s) => s.id));
  for (const step of planPathSteps) {
    if (!seen.has(step.id)) {
      merged.push(step);
      seen.add(step.id);
    }
  }

  const sorted = sortPoolCandidates(merged);
  const steps: PathToHealthyStep[] = sorted.map(
    ({ sortScore: _sortScore, impressionWeight: _impressionWeight, ...step }) => step
  );

  return {
    steps,
    actions: steps.map((step) => ({ source: step.source, id: step.id })),
  };
}

function resolvePathCalibrationConfidence(
  calibration?: AttributionCalibration,
  gapCalibration?: GapAttributionCalibration
) {
  const sampleSizes = [
    ...Object.values(calibration ?? {}).map((entry) => entry.sampleSize),
    ...Object.values(gapCalibration ?? {}).map((entry) => entry.sampleSize),
  ];
  return resolveCalibrationConfidence(Math.max(0, ...sampleSizes));
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
  const estimatedMonthlyRevenue = estimateTotalMonthlyRevenue(
    audit,
    options.avgCustomerValue
  );
  const estimatedMonthlyLeads = estimateTotalMonthlyLeads(audit);

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
    estimatedMonthlyLeads,
    projectedMonthlyLeads: estimatedMonthlyLeads,
    currentRevenueCapture: scores.revenueCapture,
    projectedRevenueCapture: scores.revenueCapture,
    calibrationConfidence: resolvePathCalibrationConfidence(
      options.calibration,
      options.gapCalibration
    ),
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
  const estimatedMonthlyLeads = estimateTotalMonthlyLeads(audit);

  if (currentDriverScore >= driverTarget) {
    return buildHealthyPathResult(audit, options, scores);
  }

  const pointsNeeded = driverTarget - currentDriverScore;
  const outcomePointsNeeded = Math.max(0, driverTarget - outcomeIndex);
  const { steps: candidateSteps, actions } = buildCandidatePool(audit, plan, options);
  const stepById = new Map(candidateSteps.map((step) => [step.id, step]));

  const counterfactualOptions = {
    calibration: options.calibration,
    gapCalibration: options.gapCalibration,
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
    estimatedMonthlyLeads,
    projectedMonthlyLeads: outcomeProjection.estimatedMonthlyLeads,
    currentRevenueCapture: scores.revenueCapture,
    projectedRevenueCapture: outcomeProjection.projectedRevenueCapture,
    calibrationConfidence: resolvePathCalibrationConfidence(
      options.calibration,
      options.gapCalibration
    ),
  };
}
