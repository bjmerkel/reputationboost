import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultMapLayers } from "@/components/platform/MapLayerControls";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";
import { keywordVisibilityLabel } from "@/audit/geo/keyword-visibility-label";
import type { KeywordRankSnapshot } from "@/audit/types";

describe("createDefaultMapLayers", () => {
  it("enables all radial rings and discrete samples by default", () => {
    const layers = createDefaultMapLayers();

    assert.equal(layers.showHeatmap, true);
    assert.deepEqual([...layers.enabledRadii].sort((a, b) => a - b), [...RADIAL_RING_MILES]);
    assert.equal(layers.heatmapSearchRadiusMiles, 1);
    assert.equal(layers.heatmapStyle, "cells");
  });
});

function radialKeyword(
  top3Counts: [number, number, number]
): KeywordRankSnapshot {
  return {
    keyword: "learning center near me",
    rankingModel: "radial_text_v2",
    centerRank: 1,
    localPackPosition: 1,
    inLocalPack: true,
    geoRanks: RADIAL_RING_MILES.map((distanceMiles, index) => ({
      distanceMiles,
      rank: index < 2 ? 1 : 9,
      inLocalPack: index < 2,
      sampleCount: 8,
      inLocalPackCount: top3Counts[index],
      visibleCount: 8,
    })),
    packLeaderRating: 0,
    packLeaderReviewCount: 0,
    clientRating: 0,
    clientReviewCount: 0,
  };
}

describe("keywordVisibilityLabel", () => {
  it("summarizes sampled coverage instead of the business-pin rank", () => {
    const label = keywordVisibilityLabel(radialKeyword([8, 8, 3]));

    assert.equal(label.text, "19/24 samples top 3 · drops at 5 mi");
    assert.equal(label.tone, "warning");
  });

  it("reports coverage without a drop when every ring has a majority", () => {
    const label = keywordVisibilityLabel(radialKeyword([8, 6, 4]));

    assert.equal(label.text, "18/24 samples top 3");
    assert.equal(label.tone, "good");
  });

  it("keeps legacy pin ranks explicitly labeled", () => {
    const legacy = radialKeyword([0, 0, 0]);
    legacy.rankingModel = undefined;
    legacy.centerRank = undefined;
    legacy.localPackPosition = "not_in_pack";
    legacy.inLocalPack = false;
    legacy.geoRanks = [{ distanceMiles: 1, rank: 8, inLocalPack: false }];

    assert.equal(keywordVisibilityLabel(legacy).text, "#8 at pin · legacy");
  });
});
