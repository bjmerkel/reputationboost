"use client";

import { useEffect, useRef, useState } from "react";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";

export type HeatmapStyle = "cells" | "gradient";

export type MapLayerState = {
  showCompetitors: boolean;
  showHeatmap: boolean;
  heatmapStyle: HeatmapStyle;
  showCompetitorZones: boolean;
  showServiceArea: boolean;
  enabledRadii: Set<number>;
  /** Text Search location-bias radius (mi) used for on-demand radial samples. */
  heatmapSearchRadiusMiles: number;
};

interface MapLayerControlsProps {
  layers: MapLayerState;
  onChange: (next: MapLayerState) => void;
}

export function createDefaultMapLayers(): MapLayerState {
  return {
    showCompetitors: true,
    showHeatmap: true,
    heatmapStyle: "cells",
    showCompetitorZones: false,
    showServiceArea: false,
    enabledRadii: new Set(RADIAL_RING_MILES),
    heatmapSearchRadiusMiles: 1,
  };
}

function LayerPill({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-[0_1px_4px_rgba(60,64,67,0.2)] transition ${
        active
          ? "bg-[#1a73e8] text-white"
          : "border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"
      }`}
    >
      {children}
    </button>
  );
}

export default function MapLayerControls({ layers, onChange }: MapLayerControlsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!advancedOpen) return;

    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) {
        setAdvancedOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [advancedOpen]);

  function toggleRadius(miles: number) {
    const next = new Set(layers.enabledRadii);
    if (next.has(miles)) {
      next.delete(miles);
    } else {
      next.add(miles);
    }
    onChange({ ...layers, enabledRadii: next });
  }

  const advancedActive =
    layers.enabledRadii.size !== RADIAL_RING_MILES.length ||
    layers.showCompetitorZones ||
    layers.showServiceArea ||
    layers.heatmapStyle === "gradient";

  return (
    <div
      ref={panelRef}
      className="absolute top-14 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 sm:top-16"
    >
      <LayerPill
        active={layers.showHeatmap}
        onClick={() => onChange({ ...layers, showHeatmap: !layers.showHeatmap })}
        title="Show measured rank samples around the business"
      >
        Rank samples
      </LayerPill>
      <LayerPill
        active={layers.showCompetitors}
        onClick={() => onChange({ ...layers, showCompetitors: !layers.showCompetitors })}
        title="Show top competitor locations"
      >
        Competitors
      </LayerPill>

      <div className="relative">
        <LayerPill
          active={advancedOpen || advancedActive}
          onClick={() => setAdvancedOpen((v) => !v)}
          title="More map layers and display options"
        >
          Layers {advancedOpen ? "▴" : "▾"}
        </LayerPill>

        {advancedOpen && (
          <div className="absolute top-full left-0 z-20 mt-1.5 w-[min(280px,calc(100vw-2rem))] rounded-xl border border-[#dadce0] bg-white p-3 shadow-lg">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
              Sample-distance rings
            </p>
            <p className="mt-0.5 text-[10px] text-[#5f6368]">
              Eight measured search locations sit on each enabled ring.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {RADIAL_RING_MILES.map((miles) => {
                const active = layers.enabledRadii.has(miles);
                return (
                  <button
                    key={miles}
                    type="button"
                    onClick={() => toggleRadius(miles)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                      active
                        ? "bg-[#202124] text-white"
                        : "border border-[#dadce0] bg-[#f8f9fa] text-[#3c4043] hover:bg-[#f1f3f4]"
                    }`}
                  >
                    {miles} mi
                  </button>
                );
              })}
            </div>

            <div className="mt-3 space-y-2 border-t border-[#e8eaed] pt-3">
              {HEATMAP_FLAGS.heatmapLayer && layers.showHeatmap && (
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={layers.heatmapStyle === "gradient"}
                    onChange={() =>
                      onChange({
                        ...layers,
                        heatmapStyle: layers.heatmapStyle === "gradient" ? "cells" : "gradient",
                      })
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[11px] font-medium text-[#202124]">
                      Interpolate between samples
                    </span>
                    <span className="text-[10px] text-[#5f6368]">
                      Display an estimated surface between measured points.
                    </span>
                  </span>
                </label>
              )}

              {HEATMAP_FLAGS.competitorDominance && (
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={layers.showCompetitorZones}
                    onChange={() =>
                      onChange({ ...layers, showCompetitorZones: !layers.showCompetitorZones })
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[11px] font-medium text-[#202124]">
                      Competitor leads
                    </span>
                    <span className="text-[10px] text-[#5f6368]">
                      Show who wins weak areas and territory outlines.
                    </span>
                  </span>
                </label>
              )}

              {HEATMAP_FLAGS.serviceAreaOverlay && (
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={layers.showServiceArea}
                    onChange={() =>
                      onChange({ ...layers, showServiceArea: !layers.showServiceArea })
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[11px] font-medium text-[#202124]">
                      Service area
                    </span>
                    <span className="text-[10px] text-[#5f6368]">
                      Your GBP service boundary or estimated coverage.
                    </span>
                  </span>
                </label>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
