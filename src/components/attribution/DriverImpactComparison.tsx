"use client";

import type { ActionAttribution } from "@/audit/types/timeseries";
import {
  driverImpactFieldsFromAttribution,
  driverImpactTone,
  formatDriverImpactLabel,
  hasDriverImpactData,
  type DriverImpactFields,
} from "@/lib/attribution/driver-impact-display";

const TONE_CLASSES = {
  light: {
    positive: "text-[#188038]",
    warning: "text-[#e37400]",
    tracking: "text-[#e37400]",
    neutral: "text-[#5f6368]",
    chipPositive: "bg-[#e6f4ea] text-[#137333]",
    chipWarning: "bg-[#fef7e0] text-[#e37400]",
    chipTracking: "bg-[#fef7e0] text-[#e37400]",
    chipNeutral: "bg-[#f1f3f4] text-[#5f6368]",
  },
  dark: {
    positive: "text-emerald-400",
    warning: "text-amber-400",
    tracking: "text-amber-400",
    neutral: "text-slate-400",
    chipPositive: "bg-emerald-500/15 text-emerald-300",
    chipWarning: "bg-amber-500/15 text-amber-300",
    chipTracking: "bg-amber-500/15 text-amber-300",
    chipNeutral: "bg-white/10 text-slate-400",
  },
} as const;

export default function DriverImpactComparison({
  attribution,
  fields,
  variant = "light",
  className = "",
  as = "text",
}: {
  attribution?: ActionAttribution | null;
  fields?: DriverImpactFields | null;
  variant?: "light" | "dark";
  className?: string;
  as?: "text" | "chip";
}) {
  const resolved = fields ?? (attribution ? driverImpactFieldsFromAttribution(attribution) : null);
  if (!resolved || !hasDriverImpactData(resolved)) return null;

  const label = formatDriverImpactLabel(resolved);
  if (!label) return null;

  const tone = driverImpactTone(resolved);
  const styles = TONE_CLASSES[variant];

  if (as === "chip") {
    const chipClass =
      tone === "positive"
        ? styles.chipPositive
        : tone === "warning"
          ? styles.chipWarning
          : tone === "tracking"
            ? styles.chipTracking
            : styles.chipNeutral;

    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${chipClass} ${className}`}>
        {label}
      </span>
    );
  }

  const textClass =
    tone === "positive"
      ? styles.positive
      : tone === "warning"
        ? styles.warning
        : tone === "tracking"
          ? styles.tracking
          : styles.neutral;

  return <p className={`text-xs font-medium ${textClass} ${className}`}>{label}</p>;
}
