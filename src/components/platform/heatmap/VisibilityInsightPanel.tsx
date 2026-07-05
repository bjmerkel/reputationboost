"use client";

import type { GeoZone, VisibilitySummary, ZoneAction } from "@/audit/geo/types";
import { formatCurrency } from "@/audit/attribution/roi";
import { ZONE_SEVERITY_COLORS } from "./zone-colors";

interface VisibilityInsightPanelProps {
  summary: VisibilitySummary;
  currency?: string;
  selectedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
  onOpenPlan?: () => void;
  topCompetitorThreat?: import("@/audit/geo/competitor-dominance").CompetitorDominance | null;
}

export default function VisibilityInsightPanel({
  summary,
  currency = "USD",
  selectedZoneId,
  onZoneSelect,
  onOpenPlan,
  topCompetitorThreat,
}: VisibilityInsightPanelProps) {
  if (!summary.hasGridData) {
    return (
      <div className="absolute bottom-4 left-4 z-10 max-w-[240px] rounded-lg border border-[#dadce0]/80 bg-white px-3 py-2.5 text-xs shadow-[0_2px_6px_rgba(60,64,67,0.15)]">
        <p className="font-medium text-[#202124]">Visibility insight</p>
        <p className="mt-1 text-[#5f6368]">
          Toggle <strong>Heatmap</strong> to load the geo grid for zone-level analysis.
        </p>
      </div>
    );
  }

  const weak = summary.zones.filter((z) => z.severity === "weak" || z.severity === "critical");

  return (
    <div className="absolute bottom-4 left-4 z-10 flex max-h-[min(320px,45vh)] w-[min(280px,calc(100%-2rem))] flex-col overflow-hidden rounded-lg border border-[#dadce0]/80 bg-white shadow-[0_2px_8px_rgba(60,64,67,0.18)]">
      <div className="shrink-0 border-b border-[#e8eaed] px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">
          Visibility insight
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-[#202124]">
          &ldquo;{summary.keyword}&rdquo;
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#5f6368]">
          <Stat label="In pack" value={`${summary.cellsInPack}/${summary.cellsTotal}`} />
          {summary.cellsWeak > 0 && <Stat label="Weak" value={String(summary.cellsWeak)} />}
          {summary.cellsCritical > 0 && (
            <Stat label="Not found" value={String(summary.cellsCritical)} warn />
          )}
        </div>
        {summary.totalRevenueAtRisk != null && summary.totalRevenueAtRisk > 0 && (
          <p className="mt-2 text-xs font-medium text-[#c5221f]">
            ~{formatCurrency(summary.totalRevenueAtRisk, currency)}/mo at risk in weak zones
          </p>
        )}
        {topCompetitorThreat && topCompetitorThreat.weakCellsOwned > 0 && (
          <p className="mt-2 rounded-lg border border-[#fce8e6] bg-[#fef7f0] px-2 py-1.5 text-[10px] text-[#c5221f]">
            <span className="font-semibold">{topCompetitorThreat.name}</span> owns{" "}
            {topCompetitorThreat.weakCellsOwned} weak cell
            {topCompetitorThreat.weakCellsOwned === 1 ? "" : "s"}
            {topCompetitorThreat.reviewGap > 0 &&
              ` · ${topCompetitorThreat.reviewGap} more reviews than you`}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {weak.length === 0 ? (
          <p className="px-1 py-2 text-xs text-[#137333]">
            Strong coverage across your geo grid — maintain posts and reviews.
          </p>
        ) : (
          weak.slice(0, 3).map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              currency={currency}
              selected={selectedZoneId === zone.id}
              onSelect={() =>
                onZoneSelect?.(selectedZoneId === zone.id ? null : zone.id)
              }
              onOpenPlan={onOpenPlan}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 ${
        warn ? "bg-[#fce8e6] text-[#c5221f]" : "bg-[#f1f3f4] text-[#5f6368]"
      }`}
    >
      {label}: {value}
    </span>
  );
}

function ZoneCard({
  zone,
  currency,
  selected,
  onSelect,
  onOpenPlan,
}: {
  zone: GeoZone;
  currency: string;
  selected: boolean;
  onSelect: () => void;
  onOpenPlan?: () => void;
}) {
  const colors = ZONE_SEVERITY_COLORS[zone.severity];
  const action = zone.recommendedActions[0];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mb-1.5 w-full rounded-lg border px-2.5 py-2 text-left transition ${
        selected
          ? "border-[#1a73e8] bg-[#e8f0fe]"
          : "border-[#e8eaed] bg-[#f8f9fa] hover:border-[#dadce0]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#202124]">{zone.label}</span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize"
          style={{ backgroundColor: `${colors.fill}22`, color: colors.text }}
        >
          {zone.severity}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-[#5f6368]">
        {zone.coveragePercent}% in pack
        {zone.avgRank != null && ` · avg #${zone.avgRank}`}
      </p>
      {zone.revenueAtRisk != null && zone.revenueAtRisk > 0 && (
        <p className="mt-0.5 text-[10px] font-medium text-[#c5221f]">
          ~{formatCurrency(zone.revenueAtRisk, currency)}/mo upside
        </p>
      )}
      {action && (
        <div className="mt-1.5 border-t border-[#e8eaed] pt-1.5">
          <p className="text-[10px] font-medium text-[#3c4043]">{action.title}</p>
          {action.taskId && onOpenPlan && (
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onOpenPlan();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onOpenPlan();
                }
              }}
              className="mt-0.5 inline-block text-[10px] font-semibold text-[#1a73e8] hover:underline"
            >
              View in Plan →
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export type { ZoneAction };
