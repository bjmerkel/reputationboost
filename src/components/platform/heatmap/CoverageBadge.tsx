"use client";

import type { VisibilitySummary } from "@/audit/geo/types";
import { coverageColor } from "./zone-colors";

export default function CoverageBadge({ summary }: { summary: VisibilitySummary }) {
  const color = coverageColor(summary.coveragePercent);
  const label = summary.hasGridData
    ? `${summary.coveragePercent}% pack coverage`
    : `${summary.coveragePercent}% visibility`;

  return (
    <div
      className="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-full border border-[#dadce0]/80 bg-white px-3 py-1.5 shadow-[0_2px_6px_rgba(60,64,67,0.15)]"
      title={`${summary.cellsInPack} of ${summary.cellsTotal || "—"} grid cells in Local 3-Pack`}
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-semibold text-[#202124]">{label}</span>
    </div>
  );
}
