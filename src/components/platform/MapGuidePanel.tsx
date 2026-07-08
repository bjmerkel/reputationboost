"use client";

import { useEffect, useState } from "react";
import type { KeywordRankSnapshot } from "@/audit/types";
import { rankColor } from "@/components/platform/heatmap/rank-colors";

const STORAGE_KEY = "rb-map-guide-dismissed";

const QUICK_START = [
  {
    title: "Pick a keyword",
    body: "Use the bar at the top to see how you rank for each search term.",
  },
  {
    title: "Read the colors",
    body: "Green = top 3 in the Local Pack. Yellow = page 1. Red = buried or missing.",
  },
  {
    title: "Tap a zone or cell",
    body: "Weak areas appear bottom-left — tap to highlight. Tap any heatmap cell for the local 3-pack.",
  },
] as const;

interface MapGuidePanelProps {
  keywordRank?: KeywordRankSnapshot;
  heatmapOn: boolean;
  gridLoading: boolean;
  hasGridData: boolean;
  enabledRadii: Set<number>;
  heatmapSearchRadiusMiles: number;
}

export default function MapGuidePanel({
  keywordRank,
  heatmapOn,
  gridLoading,
  hasGridData,
  enabledRadii,
  heatmapSearchRadiusMiles,
}: MapGuidePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [showQuickStart, setShowQuickStart] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
      setShowQuickStart(!dismissed);
      setExpanded(!dismissed);
    } catch {
      setShowQuickStart(true);
      setExpanded(true);
    }
  }, []);

  function dismissQuickStart() {
    setShowQuickStart(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures
    }
  }

  return (
    <div className="absolute bottom-4 right-4 z-10 w-[min(300px,calc(100%-2rem))] overflow-hidden rounded-lg border border-[#dadce0]/80 bg-white shadow-[0_2px_8px_rgba(60,64,67,0.18)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 border-b border-[#e8eaed] px-3 py-2.5 text-left hover:bg-[#f8f9fa]"
        aria-expanded={expanded}
      >
        <span className="text-xs font-semibold text-[#202124]">Map guide</span>
        <span className="text-[#80868b]" aria-hidden>
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="max-h-[min(360px,50vh)] overflow-y-auto px-3 py-3 text-xs">
          {showQuickStart && (
            <div className="mb-3 rounded-lg border border-[#d2e3fc] bg-[#e8f0fe] p-3">
              <p className="font-semibold text-[#1a73e8]">New here? Start in 3 steps</p>
              <ol className="mt-2 space-y-2">
                {QUICK_START.map((step, i) => (
                  <li key={step.title} className="flex gap-2 text-[#3c4043]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span>
                      <span className="font-medium text-[#202124]">{step.title}. </span>
                      {step.body}
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={dismissQuickStart}
                className="mt-3 rounded-full bg-[#1a73e8] px-3 py-1 text-[10px] font-semibold text-white hover:bg-[#1557b0]"
              >
                Got it
              </button>
            </div>
          )}

          {keywordRank && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
                Current keyword
              </p>
              <p className="mt-0.5 font-medium text-[#202124]">{keywordRank.keyword}</p>
              <p className="mt-0.5 text-[#5f6368]">
                {keywordRank.inLocalPack
                  ? `Rank #${keywordRank.localPackPosition} in Local 3-Pack (1 mi)`
                  : "Not in Local 3-Pack at 1 mi"}
              </p>
              {gridLoading && heatmapOn && (
                <p className="mt-1 text-[#1a73e8]">
                  Loading heatmap at {heatmapSearchRadiusMiles} mi…
                </p>
              )}
              {heatmapOn && hasGridData && (
                <p className="mt-1 text-[10px] text-[#80868b]">
                  Heatmap uses {heatmapSearchRadiusMiles} mi search radius per cell
                </p>
              )}
              {keywordRank.geoRanks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {keywordRank.geoRanks.map((g) => (
                    <span
                      key={g.distanceMiles}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{
                        backgroundColor: rankColor(g.rank),
                        opacity: enabledRadii.has(g.distanceMiles) ? 1 : 0.45,
                      }}
                      title={
                        enabledRadii.has(g.distanceMiles)
                          ? "Rank ring visible on map"
                          : "Enable in Layers to show this ring"
                      }
                    >
                      {g.distanceMiles} mi: {g.rank ?? "—"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
              What &ldquo;top 3&rdquo; means
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-[#5f6368]">
              Google shows three businesses first in Maps search. Green areas mean you&apos;re one
              of them when someone searches nearby.
            </p>
          </div>

          <div className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
              Heatmap colors
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {[
                { label: "Top 3 results", color: rankColor(1) },
                { label: "4–10", color: rankColor(7) },
                { label: "11+", color: rankColor(15) },
                { label: "Not found", color: rankColor(null) },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 text-[10px] text-[#5f6368]"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
            {heatmapOn && hasGridData && (
              <p className="mt-2 text-[10px] text-[#80868b]">
                Tap any colored cell to see who ranks in that area.
              </p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
              Map symbols
            </p>
            <ul className="mt-1.5 space-y-1 text-[10px] text-[#5f6368]">
              <li className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-[#ea4335]" />
                Red pin — your business
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1a73e8] text-[8px] font-bold text-white">
                  1
                </span>
                Blue markers — top competitors
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
