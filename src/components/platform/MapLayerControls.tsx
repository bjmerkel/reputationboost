"use client";

import { SEARCH_RADII_MILES } from "@/lib/google/places";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";

export type HeatmapStyle = "cells" | "gradient";

export type MapLayerState = {
  showCompetitors: boolean;
  showHeatmap: boolean;
  heatmapStyle: HeatmapStyle;
  showCompetitorZones: boolean;
  enabledRadii: Set<number>;
};

interface MapLayerControlsProps {
  layers: MapLayerState;
  onChange: (next: MapLayerState) => void;
}

export function createDefaultMapLayers(): MapLayerState {
  return {
    showCompetitors: true,
    showHeatmap: true,
    heatmapStyle: HEATMAP_FLAGS.heatmapLayer ? "gradient" : "cells",
    showCompetitorZones: HEATMAP_FLAGS.competitorDominance,
    enabledRadii: new Set(),
  };
}

export default function MapLayerControls({ layers, onChange }: MapLayerControlsProps) {
  function toggleRadius(miles: number) {
    const next = new Set(layers.enabledRadii);
    if (next.has(miles)) {
      next.delete(miles);
    } else {
      next.add(miles);
    }
    onChange({ ...layers, enabledRadii: next });
  }

  return (
    <div className="absolute top-14 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 sm:top-16">
      {SEARCH_RADII_MILES.map((miles) => {
        const active = layers.enabledRadii.has(miles);
        return (
          <button
            key={miles}
            type="button"
            onClick={() => toggleRadius(miles)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-[0_1px_4px_rgba(60,64,67,0.2)] transition ${
              active
                ? "bg-[#202124] text-white"
                : "border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"
            }`}
          >
            {miles} mi
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange({ ...layers, showHeatmap: !layers.showHeatmap })}
        className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-[0_1px_4px_rgba(60,64,67,0.2)] transition ${
          layers.showHeatmap
            ? "bg-[#34a853] text-white"
            : "border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"
        }`}
      >
        Heatmap
      </button>
      {HEATMAP_FLAGS.heatmapLayer && layers.showHeatmap && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...layers,
              heatmapStyle: layers.heatmapStyle === "gradient" ? "cells" : "gradient",
            })
          }
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-[0_1px_4px_rgba(60,64,67,0.2)] transition ${
            layers.heatmapStyle === "gradient"
              ? "bg-[#137333] text-white"
              : "border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"
          }`}
        >
          {layers.heatmapStyle === "gradient" ? "Smooth" : "Cells"}
        </button>
      )}
      {HEATMAP_FLAGS.competitorDominance && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...layers, showCompetitorZones: !layers.showCompetitorZones })
          }
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-[0_1px_4px_rgba(60,64,67,0.2)] transition ${
            layers.showCompetitorZones
              ? "bg-[#ea4335] text-white"
              : "border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"
          }`}
        >
          Who wins
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          onChange({ ...layers, showCompetitors: !layers.showCompetitors })
        }
        className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-[0_1px_4px_rgba(60,64,67,0.2)] transition ${
          layers.showCompetitors
            ? "bg-[#1a73e8] text-white"
            : "border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"
        }`}
      >
        Competitors
      </button>
    </div>
  );
}
