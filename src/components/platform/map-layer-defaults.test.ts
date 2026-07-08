import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultMapLayers } from "@/components/platform/MapLayerControls";
import { SEARCH_RADII_MILES } from "@/lib/google/places";

describe("createDefaultMapLayers", () => {
  it("enables all rank rings and widest heatmap radius by default", () => {
    const layers = createDefaultMapLayers();

    assert.equal(layers.showHeatmap, true);
    assert.deepEqual([...layers.enabledRadii].sort((a, b) => a - b), [...SEARCH_RADII_MILES]);
    assert.equal(layers.heatmapSearchRadiusMiles, Math.max(...SEARCH_RADII_MILES));
  });
});
