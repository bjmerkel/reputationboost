import type {
  GbpLocationFieldStatus,
  GbpLocationInventory,
  GbpLocationInventoryField,
  ScoreComponent,
} from "@/audit/types";
import type { CalibrationConfidence } from "@/audit/phase2/attribution-calibration";
import type { FieldAttributionCalibration } from "@/audit/phase2/field-attribution-calibration";
import { revenueScaleForField } from "@/audit/phase2/field-attribution-calibration";

/** Max driver-score points if this field moves from worst → good. */
export interface FieldScoreWeight {
  maxImpact: number;
  component: ScoreComponent;
}

/** Prior weights — calibrated later from attribution outcomes. */
export const GBP_FIELD_SCORE_WEIGHTS: Record<string, FieldScoreWeight> = {
  "profile.description": { maxImpact: 5, component: "conversion" },
  "categories.primaryCategory": { maxImpact: 4, component: "conversion" },
  "categories.additionalCategories": { maxImpact: 3, component: "conversion" },
  serviceItems: { maxImpact: 4, component: "conversion" },
  attributes: { maxImpact: 3, component: "conversion" },
  regularHours: { maxImpact: 4, component: "conversion" },
  specialHours: { maxImpact: 2, component: "conversion" },
  moreHours: { maxImpact: 1, component: "conversion" },
  "phoneNumbers.primaryPhone": { maxImpact: 2, component: "conversion" },
  "phoneNumbers.additionalPhones": { maxImpact: 1, component: "conversion" },
  websiteUri: { maxImpact: 2, component: "conversion" },
  title: { maxImpact: 1, component: "conversion" },
  storefrontAddress: { maxImpact: 2, component: "conversion" },
  serviceArea: { maxImpact: 3, component: "visibility" },
  latlng: { maxImpact: 1, component: "visibility" },
  "openInfo.status": { maxImpact: 4, component: "conversion" },
  "metadata.hasVoiceOfMerchant": { maxImpact: 3, component: "conversion" },
  "metadata.hasPendingEdits": { maxImpact: 2, component: "conversion" },
  "metadata.hasGoogleUpdated": { maxImpact: 3, component: "conversion" },
  "metadata.duplicateLocation": { maxImpact: 2, component: "conversion" },
  "content.photos": { maxImpact: 4, component: "conversion" },
  "content.posts": { maxImpact: 3, component: "conversion" },
  "engagement.reviews": { maxImpact: 5, component: "conversion" },
  "content.qa": { maxImpact: 2, component: "conversion" },
  "issues.verified": { maxImpact: 5, component: "conversion" },
};

const STATUS_MULTIPLIER: Record<GbpLocationFieldStatus, number> = {
  missing: 1,
  needs_work: 0.55,
  conflict: 0.75,
  processing: 0.15,
  blocked: 0,
  good: 0,
};

export function scoreImpactForField(
  apiPath: string,
  status: GbpLocationFieldStatus,
  fieldCalibration?: FieldAttributionCalibration
): {
  scoreImpact: number;
  scoreComponent?: ScoreComponent;
  calibrationConfidence?: CalibrationConfidence;
} {
  const weight = GBP_FIELD_SCORE_WEIGHTS[apiPath];
  if (!weight) return { scoreImpact: 0 };

  const fieldCal = fieldCalibration?.[apiPath];
  const maxImpact = fieldCal?.calibratedMaxImpact ?? weight.maxImpact;
  const multiplier = STATUS_MULTIPLIER[status] ?? 0;
  const scoreImpact = Math.round(maxImpact * multiplier * 10) / 10;

  return {
    scoreImpact,
    scoreComponent: scoreImpact > 0 ? weight.component : undefined,
    calibrationConfidence:
      fieldCal && fieldCal.confidence !== "default" ? fieldCal.confidence : undefined,
  };
}

export interface EnrichInventoryScoreOptions {
  /** Monthly calls + directions + website clicks from Performance API */
  monthlyActions?: number;
  avgCustomerValue?: number | null;
  fieldCalibration?: FieldAttributionCalibration;
}

/** Estimate monthly revenue lift from closing a field gap. */
export function estimateFieldRevenueImpact(
  scoreImpact: number,
  options: EnrichInventoryScoreOptions,
  apiPath?: string
): number | null {
  const { monthlyActions = 0, avgCustomerValue, fieldCalibration } = options;
  if (!avgCustomerValue || avgCustomerValue <= 0 || scoreImpact <= 0) return null;

  const actionBaseline = Math.max(monthlyActions, 10);
  const actionLift = (scoreImpact / 40) * actionBaseline * 0.12;
  const base = Math.round(actionLift * avgCustomerValue * 0.15);
  if (!apiPath) return base;

  const revenueScale = revenueScaleForField(apiPath, fieldCalibration);
  return Math.round(base * revenueScale);
}

export function enrichLocationInventoryScores(
  inventory: GbpLocationInventory,
  options: EnrichInventoryScoreOptions = {}
): GbpLocationInventory {
  let potentialScoreGain = 0;
  let potentialRevenueGain = 0;

  const fields: GbpLocationInventoryField[] = inventory.fields.map((field) => {
    const { scoreImpact, scoreComponent, calibrationConfidence } = scoreImpactForField(
      field.apiPath,
      field.status,
      options.fieldCalibration
    );
    const revenueImpact = estimateFieldRevenueImpact(scoreImpact, options, field.apiPath);

    potentialScoreGain += scoreImpact;
    if (revenueImpact) potentialRevenueGain += revenueImpact;

    return {
      ...field,
      scoreImpact,
      scoreComponent,
      revenueImpact: revenueImpact ?? undefined,
      calibrationConfidence,
    };
  });

  fields.sort((a, b) => (b.scoreImpact ?? 0) - (a.scoreImpact ?? 0));

  return {
    ...inventory,
    fields,
    summary: {
      ...inventory.summary,
      potentialScoreGain: Math.round(potentialScoreGain * 10) / 10,
      potentialRevenueGain: potentialRevenueGain > 0 ? potentialRevenueGain : undefined,
    },
  };
}
