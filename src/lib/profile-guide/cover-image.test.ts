import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProfileGuideCoverImage, profileGuideCoverImageUrl } from "./cover-image";
import type { GbpMediaPreview } from "@/audit/types";

function preview(overrides: Partial<GbpMediaPreview>): GbpMediaPreview {
  return {
    thumbnailUrl: "https://example.com/thumb.jpg",
    googleUrl: "https://lh3.googleusercontent.com/full.jpg",
    mediaFormat: "PHOTO",
    category: null,
    ...overrides,
  };
}

describe("profileGuideCoverImageUrl", () => {
  it("prefers googleUrl for higher resolution", () => {
    assert.equal(
      profileGuideCoverImageUrl(preview({})),
      "https://lh3.googleusercontent.com/full.jpg"
    );
  });
});

describe("isProfileGuideCoverImage", () => {
  it("matches either stored url variant", () => {
    const item = preview({});
    assert.equal(isProfileGuideCoverImage(item.thumbnailUrl, item), true);
    assert.equal(isProfileGuideCoverImage(item.googleUrl, item), true);
    assert.equal(isProfileGuideCoverImage("https://other.com/x.jpg", item), false);
  });
});
