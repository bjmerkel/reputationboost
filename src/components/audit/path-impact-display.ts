import type { PathOptimizationMode, PathToHealthyStep } from "@/audit/types";
import { formatCurrency } from "@/audit/attribution/roi";

/** Format per-step impact badge based on path optimization mode. */
export function formatPathStepImpact(
  step: PathToHealthyStep,
  mode?: PathOptimizationMode,
  currency = "USD"
): string {
  if (
    (mode === "revenue" || mode === "balanced") &&
    step.revenueImpactLabel
  ) {
    return step.revenueImpactLabel;
  }

  if ((mode === "revenue" || mode === "balanced") && (step.revenueImpact ?? 0) > 0) {
    return `+${formatCurrency(step.revenueImpact!, currency)}/mo est.`;
  }

  if (mode === "outcome" && (step.outcomeImpact ?? 0) > 0) {
    return `+${step.outcomeImpact} outcome`;
  }

  if ((step.driverImpact ?? step.scoreImpact) > 0) {
    return `+${step.driverImpact ?? step.scoreImpact} pts`;
  }

  return `+${step.scoreImpact}`;
}

export function calibrationConfidenceLabel(
  confidence?: "high" | "medium" | "low" | "default"
): string | null {
  switch (confidence) {
    case "high":
      return "Calibrated from your action history (high confidence)";
    case "medium":
      return "Calibrated from your action history (medium confidence)";
    case "low":
      return "Early calibration from limited action history";
    default:
      return null;
  }
}

export function optimizationModeHint(mode?: PathOptimizationMode): string | null {
  switch (mode) {
    case "revenue":
      return "Prioritized for revenue — rankings may lag profile strength.";
    case "outcome":
      return "Prioritized for ranking outcome and visibility.";
    case "balanced":
      return "Balanced across profile strength, rankings, and revenue.";
    default:
      return null;
  }
}
