"use client";

import type { ActionAttribution } from "@/audit/types/timeseries";
import { formatCurrency } from "@/audit/attribution/roi";
import { formatDriverImpactLabel } from "@/lib/attribution/driver-impact-display";

export default function TaskOutcomeBadge({
  attribution,
}: {
  attribution?: ActionAttribution | null;
}) {
  if (!attribution) return null;

  if (attribution.preliminary) {
    const driverLabel = formatDriverImpactLabel(attribution);
    return (
      <p className="mt-2 text-xs text-[#e37400]">
        {driverLabel ?? "Tracking outcomes for 14 days after publish…"}
      </p>
    );
  }

  const parts: string[] = [];
  if (
    attribution.rankBefore !== null &&
    attribution.rankAfter !== null &&
    attribution.rankBefore !== attribution.rankAfter
  ) {
    parts.push(
      `Rank #${attribution.rankBefore} → #${attribution.rankAfter > 20 ? "20+" : attribution.rankAfter}`
    );
  }
  if ((attribution.callsDelta ?? 0) > 0) {
    parts.push(`+${attribution.callsDelta} calls`);
  }
  if ((attribution.directionsDelta ?? 0) > 0) {
    parts.push(`+${attribution.directionsDelta} directions`);
  }
  if ((attribution.websiteClicksDelta ?? 0) > 0) {
    parts.push(`+${attribution.websiteClicksDelta} clicks`);
  }
  if (attribution.estimatedRevenue != null && attribution.estimatedRevenue > 0) {
    parts.push(`~${formatCurrency(attribution.estimatedRevenue)} est.`);
  }

  const driverLabel = formatDriverImpactLabel(attribution);
  if (driverLabel) {
    parts.push(driverLabel);
  }

  if (parts.length === 0) {
    return (
      <p className="mt-2 text-xs text-[#5f6368]">
        No measurable lift yet — check back as daily data accumulates.
      </p>
    );
  }

  return (
    <p className="mt-2 text-xs font-medium text-[#188038]">Outcome: {parts.join(" · ")}</p>
  );
}
