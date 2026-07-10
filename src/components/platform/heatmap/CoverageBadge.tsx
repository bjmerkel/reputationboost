"use client";

import type { VisibilitySummary } from "@/audit/geo/types";
import { coverageColor } from "./zone-colors";
import { formatCoverageDisplay } from "./coverage-labels";

export default function CoverageBadge({ summary }: { summary: VisibilitySummary }) {
  const color = coverageColor(summary.coveragePercent);
  const { headline, subline } = formatCoverageDisplay(summary);

  return (
    <div
      className="absolute top-32 right-3 z-10 max-w-[min(240px,calc(100%-1.5rem))] rounded-lg border border-[#dadce0]/80 bg-white px-3 py-2 shadow-[0_2px_6px_rgba(60,64,67,0.15)] sm:top-24"
      title={subline}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-snug text-[#202124]">{headline}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-[#5f6368]">{subline}</p>
        </div>
      </div>
    </div>
  );
}
