"use client";

import { SEARCH_RADII_MILES } from "@/lib/google/places";

export type MapLayerState = {
  showCompetitors: boolean;
  enabledRadii: Set<number>;
};

interface MapLayerControlsProps {
  layers: MapLayerState;
  onChange: (next: MapLayerState) => void;
}

export function createDefaultMapLayers(): MapLayerState {
  return {
    showCompetitors: true,
    enabledRadii: new Set(SEARCH_RADII_MILES),
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
    <div className="absolute top-3 left-1/2 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2">
      {SEARCH_RADII_MILES.map((miles) => {
        const active = layers.enabledRadii.has(miles);
        return (
          <button
            key={miles}
            type="button"
            onClick={() => toggleRadius(miles)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-md transition ${
              active
                ? "bg-[#202124] text-white"
                : "bg-white text-[#3c4043] hover:bg-[#f1f3f4]"
            }`}
          >
            {miles} mi
          </button>
        );
      })}
      <button
        type="button"
        onClick={() =>
          onChange({ ...layers, showCompetitors: !layers.showCompetitors })
        }
        className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-md transition ${
          layers.showCompetitors
            ? "bg-[#1a73e8] text-white"
            : "bg-white text-[#3c4043] hover:bg-[#f1f3f4]"
        }`}
      >
        Competitors
      </button>
    </div>
  );
}
