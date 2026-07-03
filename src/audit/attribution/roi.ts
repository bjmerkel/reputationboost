export interface RoiConfig {
  callConversionRate: number;
  directionConversionRate: number;
  websiteClickConversionRate: number;
}

export const DEFAULT_ROI_CONFIG: RoiConfig = {
  callConversionRate: 0.25,
  directionConversionRate: 0.3,
  websiteClickConversionRate: 0.05,
};

export interface EngagementDeltas {
  calls: number;
  directions: number;
  websiteClicks: number;
}

/** Estimate revenue from attributed engagement deltas and average job value. */
export function estimateAttributionRevenue(
  deltas: EngagementDeltas,
  avgCustomerValue: number,
  config: RoiConfig = DEFAULT_ROI_CONFIG
): number {
  if (avgCustomerValue <= 0) return 0;

  const leads =
    Math.max(0, deltas.calls) * config.callConversionRate +
    Math.max(0, deltas.directions) * config.directionConversionRate +
    Math.max(0, deltas.websiteClicks) * config.websiteClickConversionRate;

  return Math.round(leads * avgCustomerValue);
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildRoiHeadline(
  totalRevenue: number,
  periodLabel: string,
  currency = "USD"
): string {
  if (totalRevenue <= 0) return "";
  return `Reputation Boost drove an estimated ${formatCurrency(totalRevenue, currency)} in ${periodLabel}`;
}
