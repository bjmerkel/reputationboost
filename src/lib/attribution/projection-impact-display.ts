import type { ActionAttribution } from "@/audit/types/timeseries";
import { formatCurrency } from "@/audit/attribution/roi";
import { formatSignedPoints } from "./driver-impact-display";

export interface OutcomeImpactFields {
  preliminary?: boolean;
  projectedOutcomeImpact?: number | null;
  observedOutcomeImpact?: number | null;
  outcomeIndexBefore?: number | null;
  outcomeIndexAfter?: number | null;
}

export interface RevenueImpactFields {
  preliminary?: boolean;
  projectedRevenueGain?: number | null;
  estimatedRevenue?: number | null;
  currency?: string;
}

export function formatOutcomeImpactLabel(fields: OutcomeImpactFields): string | null {
  if (fields.preliminary) {
    if (fields.projectedOutcomeImpact != null) {
      return `Tracking outcome (projected ${formatSignedPoints(fields.projectedOutcomeImpact)})`;
    }
    return null;
  }

  const {
    projectedOutcomeImpact,
    observedOutcomeImpact,
    outcomeIndexBefore,
    outcomeIndexAfter,
  } = fields;

  if (observedOutcomeImpact != null && projectedOutcomeImpact != null) {
    if (outcomeIndexBefore != null && outcomeIndexAfter != null) {
      return `Outcome ${outcomeIndexBefore} → ${outcomeIndexAfter} (projected ${formatSignedPoints(projectedOutcomeImpact)})`;
    }

    const error = observedOutcomeImpact - projectedOutcomeImpact;
    if (Math.abs(error) >= 3) {
      return `Outcome ${formatSignedPoints(observedOutcomeImpact)} (projected ${formatSignedPoints(projectedOutcomeImpact)})`;
    }
    if (observedOutcomeImpact > 0) {
      return `Outcome ${formatSignedPoints(observedOutcomeImpact)}`;
    }
  }

  if (observedOutcomeImpact != null) {
    return `Outcome ${formatSignedPoints(observedOutcomeImpact)}`;
  }

  if (projectedOutcomeImpact != null) {
    return `Projected ${formatSignedPoints(projectedOutcomeImpact)} outcome pts`;
  }

  return null;
}

export function formatRevenueImpactLabel(fields: RevenueImpactFields): string | null {
  const currency = fields.currency ?? "USD";

  if (fields.preliminary) {
    if (fields.projectedRevenueGain != null && fields.projectedRevenueGain > 0) {
      return `Tracking revenue (projected ${formatCurrency(fields.projectedRevenueGain, currency)}/mo)`;
    }
    return null;
  }

  const { projectedRevenueGain, estimatedRevenue } = fields;
  if (estimatedRevenue != null && estimatedRevenue > 0 && projectedRevenueGain != null) {
    const error = estimatedRevenue - projectedRevenueGain;
    if (Math.abs(error) >= Math.max(100, projectedRevenueGain * 0.5)) {
      return `Revenue ${formatCurrency(estimatedRevenue, currency)} (projected ${formatCurrency(projectedRevenueGain, currency)})`;
    }
    return `Revenue ${formatCurrency(estimatedRevenue, currency)}`;
  }

  if (estimatedRevenue != null && estimatedRevenue > 0) {
    return `Revenue ${formatCurrency(estimatedRevenue, currency)}`;
  }

  if (projectedRevenueGain != null && projectedRevenueGain > 0) {
    return `Projected ${formatCurrency(projectedRevenueGain, currency)}/mo`;
  }

  return null;
}

export function outcomeImpactFieldsFromAttribution(
  attribution: ActionAttribution
): OutcomeImpactFields {
  return {
    preliminary: attribution.preliminary,
    projectedOutcomeImpact: attribution.projectedOutcomeImpact,
    observedOutcomeImpact: attribution.observedOutcomeImpact,
    outcomeIndexBefore: attribution.outcomeIndexBefore,
    outcomeIndexAfter: attribution.outcomeIndexAfter,
  };
}

export function revenueImpactFieldsFromAttribution(
  attribution: ActionAttribution,
  currency = "USD"
): RevenueImpactFields {
  return {
    preliminary: attribution.preliminary,
    projectedRevenueGain: attribution.projectedRevenueGain,
    estimatedRevenue: attribution.estimatedRevenue,
    currency,
  };
}

export function hasOutcomeImpactData(fields: OutcomeImpactFields): boolean {
  return (
    fields.projectedOutcomeImpact != null ||
    fields.observedOutcomeImpact != null ||
    fields.preliminary === true
  );
}

export function hasRevenueImpactData(fields: RevenueImpactFields): boolean {
  return (
    (fields.projectedRevenueGain != null && fields.projectedRevenueGain > 0) ||
    (fields.estimatedRevenue != null && fields.estimatedRevenue > 0) ||
    fields.preliminary === true
  );
}
