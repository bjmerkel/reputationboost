"use client";

import { useCallback, useEffect, useState } from "react";
import type { CellPortfolioEntry } from "@/audit/autopilot/cell-portfolio";

const STATUS_LABELS: Record<CellPortfolioEntry["experimentStatus"], string> = {
  none: "No test",
  available: "Ready to test",
  proposed: "Suggested",
  pending_approval: "Needs approval",
  running: "Running",
  measuring: "Measuring",
  won: "Won",
  lost: "No movement",
  inconclusive: "Inconclusive",
  cancelled: "Cancelled",
};

export default function CellPortfolioPanel({
  clientId,
  variant = "light",
  onOpenCell,
}: {
  clientId: string;
  variant?: "light" | "dark";
  onOpenCell?: (keyword: string, gridNorth: number, gridEast: number) => void;
}) {
  const isLight = variant === "light";
  const [cells, setCells] = useState<CellPortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/autopilot/cell-portfolio?clientId=${encodeURIComponent(clientId)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { cells?: CellPortfolioEntry[] };
      setCells(data.cells ?? []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || cells.length === 0) return null;

  return (
    <section
      className={`rounded-xl border p-4 ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-slate-900"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          isLight ? "text-[#80868b]" : "text-slate-500"
        }`}
      >
        Weak cells portfolio
      </p>
      <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Losing neighborhoods ranked by opportunity — experiment status per cell.
      </p>

      <ul className="mt-3 space-y-2">
        {cells.map((cell) => (
          <li
            key={`${cell.keyword}-${cell.gridNorth}-${cell.gridEast}`}
            className={`rounded-lg border px-3 py-3 ${
              isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                  {cell.keyword}
                </p>
                <p className={`mt-0.5 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                  {cell.directionLabel} · vs {cell.leaderName}
                  {cell.rank == null ? " · not visible" : ` · you are #${cell.rank}`}
                </p>
                {cell.topHypothesis && (
                  <p className={`mt-1 text-xs ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
                    {cell.topHypothesis}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  cell.experimentStatus === "won"
                    ? isLight
                      ? "bg-[#e6f4ea] text-[#137333]"
                      : "bg-emerald-400/15 text-emerald-300"
                    : cell.experimentStatus === "available" || cell.experimentStatus === "proposed"
                      ? isLight
                        ? "bg-[#e8f0fe] text-[#1a73e8]"
                        : "bg-sky-400/15 text-sky-300"
                      : isLight
                        ? "bg-[#f1f3f4] text-[#5f6368]"
                        : "bg-white/10 text-slate-400"
                }`}
              >
                {STATUS_LABELS[cell.experimentStatus]}
              </span>
            </div>
            {onOpenCell && (
              <button
                type="button"
                onClick={() => onOpenCell(cell.keyword, cell.gridNorth, cell.gridEast)}
                className={`mt-2 text-xs font-semibold ${
                  isLight ? "text-[#1a73e8]" : "text-sky-300"
                }`}
              >
                View on map →
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
