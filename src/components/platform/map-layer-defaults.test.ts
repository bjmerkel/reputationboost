import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultMapLayers } from "@/components/platform/MapLayerControls";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";

describe("createDefaultMapLayers", () => {
  it("enables all radial rings and discrete samples by default", () => {
    const layers = createDefaultMapLayers();

    assert.equal(layers.showHeatmap, true);
    assert.deepEqual([...layers.enabledRadii].sort((a, b) => a - b), [...RADIAL_RING_MILES]);
    assert.equal(layers.heatmapSearchRadiusMiles, 1);
    assert.equal(layers.heatmapStyle, "cells");
  });
});
