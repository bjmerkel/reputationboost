import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpMediaPreview } from "@/audit/types";
import {
  extractFlyerGbpPhotos,
  selectFlyerCoverPhoto,
  toFlyerGbpPhoto,
} from "./photo-picker";

function preview(overrides: Partial<GbpMediaPreview> & Pick<GbpMediaPreview, "thumbnailUrl">): GbpMediaPreview {
  return {
    googleUrl: overrides.googleUrl ?? overrides.thumbnailUrl,
    mediaFormat: "PHOTO",
    category: null,
    ...overrides,
  };
}

describe("flyer photo picker", () => {
  it("prefers food photos for editorial-food archetype", () => {
    const photos = extractFlyerGbpPhotos([
      preview({ thumbnailUrl: "https://example.com/exterior.jpg", category: "EXTERIOR" }),
      preview({ thumbnailUrl: "https://example.com/food.jpg", category: "FOOD", viewCount: 42 }),
    ]);

    assert.equal(
      selectFlyerCoverPhoto({
        archetype: "editorial-food",
        photos,
      }),
      "https://example.com/food.jpg"
    );
  });

  it("falls back to guide cover before smart pick", () => {
    const photos = extractFlyerGbpPhotos([
      preview({ thumbnailUrl: "https://example.com/exterior.jpg", category: "EXTERIOR" }),
    ]);

    assert.equal(
      selectFlyerCoverPhoto({
        archetype: "local-trust",
        photos,
        guideCoverUrl: "https://example.com/guide-cover.jpg",
      }),
      "https://example.com/guide-cover.jpg"
    );
  });

  it("uses selected cover override first", () => {
    const photos = extractFlyerGbpPhotos([
      preview({ thumbnailUrl: "https://example.com/exterior.jpg", category: "EXTERIOR" }),
    ]);

    assert.equal(
      selectFlyerCoverPhoto({
        archetype: "local-trust",
        photos,
        guideCoverUrl: "https://example.com/guide-cover.jpg",
        selectedCoverUrl: "https://example.com/custom.jpg",
      }),
      "https://example.com/custom.jpg"
    );
  });

  it("skips non-photo media", () => {
    const photo = toFlyerGbpPhoto(
      preview({ thumbnailUrl: "https://example.com/photo.jpg", mediaFormat: "VIDEO" })
    );
    assert.equal(photo, null);
  });
});
