import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpMediaItem } from "./gbp-media";
import {
  analyzeGbpMediaCoverage,
  validateMediaUploadBytes,
} from "./gbp-media-coverage";

function mediaItem(
  overrides: Partial<GbpMediaItem> & Pick<GbpMediaItem, "category">
): GbpMediaItem {
  return {
    name: "accounts/a/locations/l/media/m1",
    mediaFormat: "PHOTO",
    googleUrl: "https://example.com/photo.jpg",
    thumbnailUrl: "https://example.com/thumb.jpg",
    createTime: "2026-06-01T00:00:00Z",
    description: "",
    viewCount: "12",
    ...overrides,
  };
}

describe("analyzeGbpMediaCoverage", () => {
  it("flags missing recommended categories and computes coverage score", () => {
    const coverage = analyzeGbpMediaCoverage([
      mediaItem({ category: "EXTERIOR", viewCount: "40" }),
      mediaItem({ category: "AT_WORK", createTime: "2026-06-15T00:00:00Z" }),
    ]);

    assert.equal(coverage.hasExterior, true);
    assert.equal(coverage.hasInterior, false);
    assert.equal(coverage.hasTeam, false);
    assert.ok(coverage.missingCategories.includes("INTERIOR"));
    assert.ok(coverage.missingCategories.includes("TEAMS"));
    assert.equal(coverage.totalViews, 52);
    assert.ok(coverage.coverageScore > 0 && coverage.coverageScore < 100);
  });

  it("detects customer-uploaded media via attribution", () => {
    const coverage = analyzeGbpMediaCoverage([
      mediaItem({
        category: "ADDITIONAL",
        attribution: { profileName: "Jane Customer" },
      }),
      mediaItem({ category: "EXTERIOR" }),
    ]);

    assert.equal(coverage.customerPhotoCount, 1);
    assert.equal(coverage.ownerPhotoCount, 1);
    assert.equal(coverage.customerPhotoShare, 50);
  });

  it("computes engagement metrics from owner photo views", () => {
    const coverage = analyzeGbpMediaCoverage([
      mediaItem({ category: "EXTERIOR", viewCount: "30" }),
      mediaItem({ category: "INTERIOR", viewCount: "10" }),
      mediaItem({ category: "AT_WORK", viewCount: "0" }),
      mediaItem({ category: "TEAMS", viewCount: "0" }),
      mediaItem({
        category: "ADDITIONAL",
        viewCount: "100",
        attribution: { profileName: "Customer" },
      }),
    ]);

    assert.equal(coverage.ownerTotalViews, 40);
    assert.equal(coverage.ownerAvgViews, 10);
    assert.equal(coverage.ownerZeroViewCount, 2);
    assert.equal(coverage.customerPhotoShare, 20);
    assert.ok(coverage.engagementScore > 0 && coverage.engagementScore < 100);
  });
});

describe("validateMediaUploadBytes", () => {
  it("rejects files below Google's 10KB minimum", () => {
    const tiny = new ArrayBuffer(1024);
    const result = validateMediaUploadBytes(tiny);
    assert.equal(result.valid, false);
    assert.match(result.reason ?? "", /10 KB/);
  });
});
