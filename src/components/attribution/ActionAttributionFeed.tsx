"use client";

import type { ActionAttribution } from "@/audit/types/timeseries";
import { formatCurrency } from "@/audit/attribution/roi";

function formatRank(rank: number | null): string {
  if (rank === null) return "—";
  if (rank > 20) return "#20+";
  return `#${rank}`;
}

export default function ActionAttributionFeed({
  attributions,
  loading = false,
  limit = 8,
}: {
  attributions: ActionAttribution[];
  loading?: boolean;
  limit?: number;
}) {
  if (loading) {
    return (
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-[#202124]">What your actions drove</h4>
        <p className="text-sm text-[#5f6368]">Loading…</p>
      </section>
    );
  }

  const items = attributions.slice(0, limit);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold text-[#202124]">What your actions drove</h4>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-[#dadce0] bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-medium text-[#202124]">{item.title}</p>
              {item.preliminary && (
                <span className="rounded-full bg-[#fef7e0] px-2 py-0.5 text-[10px] font-medium text-[#e37400]">
                  Tracking
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[#3c4043]">{item.narrative}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#5f6368]">
              {item.primaryKeyword && (
                <span>Keyword: {item.primaryKeyword}</span>
              )}
              {item.rankBefore !== item.rankAfter && item.rankAfter !== null && (
                <span className="text-[#188038]">
                  Rank {formatRank(item.rankBefore)} → {formatRank(item.rankAfter)}
                </span>
              )}
              {(item.callsDelta ?? 0) !== 0 && (
                <span className={(item.callsDelta ?? 0) > 0 ? "text-[#188038]" : "text-[#d93025]"}>
                  {(item.callsDelta ?? 0) > 0 ? "+" : ""}
                  {item.callsDelta} calls
                </span>
              )}
              {item.estimatedRevenue != null && item.estimatedRevenue > 0 && (
                <span className="font-medium text-[#188038]">
                  ~{formatCurrency(item.estimatedRevenue)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
