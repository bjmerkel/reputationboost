"use client";

import type { ActionAttribution } from "@/audit/types/timeseries";
import DriverImpactComparison from "@/components/attribution/DriverImpactComparison";
import {
  formatOutcomeImpactLabel,
  formatRevenueImpactLabel,
  hasOutcomeImpactData,
  hasRevenueImpactData,
  outcomeImpactFieldsFromAttribution,
  revenueImpactFieldsFromAttribution,
} from "@/lib/attribution/projection-impact-display";

export default function ActionImpactComparison({
  attribution,
  currency = "USD",
  variant = "light",
  className = "",
}: {
  attribution: ActionAttribution;
  currency?: string;
  variant?: "light" | "dark";
  className?: string;
}) {
  const outcomeFields = outcomeImpactFieldsFromAttribution(attribution);
  const revenueFields = revenueImpactFieldsFromAttribution(attribution, currency);
  const outcomeLabel = formatOutcomeImpactLabel(outcomeFields);
  const revenueLabel = formatRevenueImpactLabel(revenueFields);

  const toneClass =
    variant === "light" ? "text-[#1a73e8]" : "text-cyan-300";
  const revenueToneClass =
    variant === "light" ? "text-[#188038]" : "text-emerald-400";

  return (
    <div className={`space-y-1 ${className}`}>
      <DriverImpactComparison attribution={attribution} variant={variant} />
      {hasOutcomeImpactData(outcomeFields) && outcomeLabel && (
        <p className={`text-xs font-medium ${toneClass}`}>{outcomeLabel}</p>
      )}
      {hasRevenueImpactData(revenueFields) && revenueLabel && (
        <p className={`text-xs font-medium ${revenueToneClass}`}>{revenueLabel}</p>
      )}
    </div>
  );
}
