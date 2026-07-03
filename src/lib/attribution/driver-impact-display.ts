import type { ActionAttribution } from "@/audit/types/timeseries";

export type DriverImpactTone = "neutral" | "positive" | "warning" | "tracking";

export interface DriverImpactFields {
  preliminary?: boolean;
  projectedDriverImpact?: number | null;
  observedDriverImpact?: number | null;
  driverScoreBefore?: number | null;
  driverScoreAfter?: number | null;
}

export function formatSignedPoints(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

/** Human-readable projected vs observed listing-strength label. */
export function formatDriverImpactLabel(fields: DriverImpactFields): string | null {
  if (fields.preliminary) {
    if (fields.projectedDriverImpact != null) {
      return `Tracking listing strength (projected ${formatSignedPoints(fields.projectedDriverImpact)} pts)`;
    }
    return "Tracking listing strength…";
  }

  const {
    projectedDriverImpact,
    observedDriverImpact,
    driverScoreBefore,
    driverScoreAfter,
  } = fields;

  if (observedDriverImpact != null && projectedDriverImpact != null) {
    if (driverScoreBefore != null && driverScoreAfter != null) {
      return `Listing strength ${driverScoreBefore} → ${driverScoreAfter} (projected ${formatSignedPoints(projectedDriverImpact)})`;
    }

    const error = observedDriverImpact - projectedDriverImpact;
    if (Math.abs(error) >= 3) {
      return `Listing strength ${formatSignedPoints(observedDriverImpact)} pts (projected ${formatSignedPoints(projectedDriverImpact)})`;
    }
    if (observedDriverImpact > 0) {
      return `Listing strength ${formatSignedPoints(observedDriverImpact)} pts`;
    }
    return `Listing strength ${formatSignedPoints(observedDriverImpact)} pts (projected ${formatSignedPoints(projectedDriverImpact)})`;
  }

  if (observedDriverImpact != null) {
    if (driverScoreBefore != null && driverScoreAfter != null) {
      return `Listing strength ${driverScoreBefore} → ${driverScoreAfter}`;
    }
    return `Listing strength ${formatSignedPoints(observedDriverImpact)} pts`;
  }

  if (projectedDriverImpact != null) {
    return `Projected ${formatSignedPoints(projectedDriverImpact)} listing strength pts`;
  }

  return null;
}

export function driverImpactTone(fields: DriverImpactFields): DriverImpactTone {
  if (fields.preliminary) return "tracking";

  const { projectedDriverImpact, observedDriverImpact } = fields;
  if (observedDriverImpact == null) return "neutral";
  if (projectedDriverImpact == null) {
    return observedDriverImpact > 0 ? "positive" : "neutral";
  }

  const error = observedDriverImpact - projectedDriverImpact;
  if (observedDriverImpact > 0 && error >= -2) return "positive";
  if (error <= -3) return "warning";
  return "neutral";
}

export function hasDriverImpactData(fields: DriverImpactFields): boolean {
  return (
    fields.projectedDriverImpact != null ||
    fields.observedDriverImpact != null ||
    fields.preliminary === true
  );
}

export function driverImpactFieldsFromAttribution(
  attribution: ActionAttribution
): DriverImpactFields {
  return {
    preliminary: attribution.preliminary,
    projectedDriverImpact: attribution.projectedDriverImpact,
    observedDriverImpact: attribution.observedDriverImpact,
    driverScoreBefore: attribution.driverScoreBefore,
    driverScoreAfter: attribution.driverScoreAfter,
  };
}
