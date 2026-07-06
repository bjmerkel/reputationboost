import type { CalibrationConfidence } from "./attribution-calibration";
import {
  projectionRevenueScaleForStep,
  projectionScaleForStep,
  type AttributionCalibration,
} from "./attribution-calibration";
import {
  GBP_FIELD_SCORE_WEIGHTS,
  type FieldScoreWeight,
} from "@/lib/google/gbp-field-score-impact";
import { planLinkForApiPath } from "@/lib/google/gbp-field-plan-links";

export interface FieldCalibration {
  apiPath: string;
  priorMaxImpact: number;
  calibratedMaxImpact: number;
  scaleFactor: number;
  confidence: CalibrationConfidence;
  sourceStepNumber: number;
  sampleSize: number;
}

export type FieldAttributionCalibration = Record<string, FieldCalibration>;

function fieldsForStep(stepNumber: number): string[] {
  return Object.keys(GBP_FIELD_SCORE_WEIGHTS).filter((apiPath) => {
    const link = planLinkForApiPath(apiPath);
    if (!link) return false;
    return link.planStepNumber === stepNumber || link.alternateStepNumber === stepNumber;
  });
}

function priorWeightShare(apiPath: string, stepNumber: number): number {
  const siblings = fieldsForStep(stepNumber);
  const total = siblings.reduce(
    (sum, path) => sum + (GBP_FIELD_SCORE_WEIGHTS[path]?.maxImpact ?? 0),
    0
  );
  if (total <= 0) return 1;
  return (GBP_FIELD_SCORE_WEIGHTS[apiPath]?.maxImpact ?? 0) / total;
}

function resolveStepNumber(apiPath: string): number | null {
  const link = planLinkForApiPath(apiPath);
  return link?.planStepNumber ?? null;
}

function calibratedMaxImpactForField(
  apiPath: string,
  weight: FieldScoreWeight,
  stepCalibration?: AttributionCalibration
): FieldCalibration {
  const stepNumber = resolveStepNumber(apiPath);
  if (stepNumber == null) {
    return {
      apiPath,
      priorMaxImpact: weight.maxImpact,
      calibratedMaxImpact: weight.maxImpact,
      scaleFactor: 1,
      confidence: "default",
      sourceStepNumber: -1,
      sampleSize: 0,
    };
  }

  const cal = stepCalibration?.[stepNumber];
  const scaleFactor = projectionScaleForStep(stepNumber, stepCalibration);
  let calibrated = weight.maxImpact * scaleFactor;

  if (cal && cal.sampleSize >= 2 && cal.estimatedScoreImpact > 0) {
    const share = priorWeightShare(apiPath, stepNumber);
    const observedShare = cal.estimatedScoreImpact * share;
    const blendWeight =
      cal.projectionSampleSize >= 5 ? 0.75 : cal.projectionSampleSize >= 2 ? 0.65 : 0.55;
    calibrated = calibrated * (1 - blendWeight) + observedShare * blendWeight;
  }

  calibrated = Math.max(0.5, Math.min(8, Math.round(calibrated * 10) / 10));

  return {
    apiPath,
    priorMaxImpact: weight.maxImpact,
    calibratedMaxImpact: calibrated,
    scaleFactor,
    confidence: cal?.confidence ?? "default",
    sourceStepNumber: stepNumber,
    sampleSize: cal?.sampleSize ?? 0,
  };
}

/**
 * Derive per-field score weights from step-level attribution calibration.
 * Uses gbp-field-plan-links to bridge apiPath → plan step.
 */
export function buildFieldAttributionCalibration(
  stepCalibration?: AttributionCalibration
): FieldAttributionCalibration {
  const result: FieldAttributionCalibration = {};

  for (const [apiPath, weight] of Object.entries(GBP_FIELD_SCORE_WEIGHTS)) {
    result[apiPath] = calibratedMaxImpactForField(apiPath, weight, stepCalibration);
  }

  return result;
}

export function revenueScaleForField(
  apiPath: string,
  fieldCalibration?: FieldAttributionCalibration,
  stepCalibration?: AttributionCalibration
): number {
  const stepNumber =
    fieldCalibration?.[apiPath]?.sourceStepNumber ?? resolveStepNumber(apiPath);
  if (stepNumber == null || stepNumber < 0) return 1;
  return projectionRevenueScaleForStep(stepNumber, stepCalibration);
}
