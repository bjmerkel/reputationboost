import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpMediaItem } from "./gbp-media";
import { analyzeGbpMediaCoverage } from "./gbp-media-coverage";
import { buildMediaMaintenanceActions } from "./gbp-media-maintenance";

function photo(
  name: string,
  category: GbpMediaItem["category"],
  options?: Partial<GbpMediaItem>
): GbpMediaItem {
  return {
    name,
    mediaFormat: "PHOTO",
    category,
    googleUrl: `https://example.com/${name}.jpg`,
    thumbnailUrl: `https://example.com/${name}-thumb.jpg`,
    createTime: "2025-01-01T00:00:00Z",
    description: "",
    viewCount: options?.viewCount ?? "0",
    ...options,
  };
}

describe("buildMediaMaintenanceActions", () => {
  it("suggests recategorizing additional photos into missing categories", () => {
    const items = [
      photo("accounts/a/locations/l/media/1", "ADDITIONAL"),
      photo("accounts/a/locations/l/media/2", "ADDITIONAL"),
      photo("accounts/a/locations/l/media/3", "EXTERIOR"),
    ];
    const coverage = analyzeGbpMediaCoverage(items);

    const actions = buildMediaMaintenanceActions(items, coverage);
    assert.ok(actions.some((action) => action.type === "recategorize"));
    assert.ok(actions.some((action) => action.targetCategory === "INTERIOR"));
  });

  it("suggests deleting stale zero-view additional photos", () => {
    const items = [
      photo("accounts/a/locations/l/media/exterior", "EXTERIOR"),
      photo("accounts/a/locations/l/media/interior", "INTERIOR"),
      photo("accounts/a/locations/l/media/atwork", "AT_WORK"),
      photo("accounts/a/locations/l/media/team", "TEAMS"),
      photo("accounts/a/locations/l/media/old", "ADDITIONAL", {
        createTime: "2024-01-01T00:00:00Z",
        viewCount: "0",
      }),
    ];
    const coverage = analyzeGbpMediaCoverage(items);

    const actions = buildMediaMaintenanceActions(items, coverage);
    assert.ok(actions.some((action) => action.type === "delete" && action.mediaName.includes("old")));
  });
});
