import type { PlanStep } from "../types";
import {
  negativeEvidencePenalty,
  resolveCalibrationConfidence,
  type AttributionCalibration,
} from "./attribution-calibration";
import { PLAN_STEP_EFFORT } from "./gbp-plan";

/** Composite expected value from plan step context (revenue > leads > engagement > scores). */
export function stepExpectedValue(step: PlanStep): number {
  const revenue = step.context.revenueImpact ?? 0;
  if (revenue > 0) return revenue;

  const leads = step.context.leadsImpact ?? 0;
  if (leads > 0) return leads * 50;

  const engagement = step.context.engagementImpact ?? 0;
  if (engagement > 0) return engagement * 10;

  return (
    (step.context.outcomeScoreImpact ?? 0) * 10 + (step.context.healthScoreImpact ?? 0)
  );
}

/** Confidence discount from per-step attribution sample size. */
export function stepConfidenceMultiplier(
  stepNumber: number,
  calibration?: AttributionCalibration
): number {
  const cal = calibration?.[stepNumber];
  if (!cal || cal.sampleSize < 1) return 0.6;
  if (cal.sampleSize === 1) return 0.75;

  switch (resolveCalibrationConfidence(cal.sampleSize)) {
    case "high":
      return 1;
    case "medium":
      return 0.85;
    case "low":
      return 0.7;
    default:
      return 0.6;
  }
}

export function planStepEffort(stepNumber: number): number {
  return PLAN_STEP_EFFORT[stepNumber] ?? 4;
}

/**
 * Priority score for NBA ordering: (expected value × confidence × evidence) ÷ effort.
 * Failed actions are demoted via negativeEvidencePenalty.
 */
export function planStepPriorityScore(
  step: PlanStep,
  options?: {
    calibration?: AttributionCalibration;
    conversionBoost?: number;
  }
): number {
  const expected = stepExpectedValue(step);
  if (expected <= 0) return 0;

  const confidence = stepConfidenceMultiplier(step.stepNumber, options?.calibration);
  const effort = planStepEffort(step.stepNumber);
  const evidence = negativeEvidencePenalty(step.stepNumber, options?.calibration);
  const conversionBoost = options?.conversionBoost ?? 1;

  return (expected * confidence * evidence * conversionBoost) / effort;
}
