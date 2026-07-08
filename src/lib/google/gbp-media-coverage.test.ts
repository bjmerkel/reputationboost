import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpMediaItem } from "./gbp-media";
import {
  analyzeGbpMediaCoverage,
  buildAtWorkPhotoHint,
  missingMediaGapCopy,
  validateMediaUploadBytes,
  validateMediaVideoUpload,
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
    assert.equal(coverage.photoViewsAvailable, true);
    assert.ok(coverage.engagementScore > 0 && coverage.engagementScore < 100);
  });

  it("treats missing MediaInsights as unavailable photo views", () => {
    const coverage = analyzeGbpMediaCoverage([
      mediaItem({ category: "EXTERIOR", viewCount: null }),
      mediaItem({ category: "INTERIOR", viewCount: null }),
      mediaItem({ category: "AT_WORK", viewCount: null }),
    ]);

    assert.equal(coverage.photoViewsAvailable, false);
    assert.equal(coverage.totalViews, 0);
    assert.equal(coverage.ownerTotalViews, 0);
    assert.equal(coverage.ownerZeroViewCount, 0);
    assert.equal(coverage.engagementScore, 100);
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

describe("validateMediaVideoUpload", () => {
  it("rejects videos below 100KB", () => {
    const small = new ArrayBuffer(50_000);
    const result = validateMediaVideoUpload(small);
    assert.equal(result.valid, false);
    assert.match(result.reason ?? "", /100 KB/);
  });
});

describe("buildAtWorkPhotoHint", () => {
  it("returns industry-specific guidance for plumbers", () => {
    const hint = buildAtWorkPhotoHint("Plumber", "Austin");
    assert.match(hint, /on-site|before\/after/i);
    assert.match(hint, /Austin/);
  });

  it("falls back to generic service guidance", () => {
    const hint = buildAtWorkPhotoHint("Acupuncture Clinic", "Denver");
    assert.match(hint, /Acupuncture Clinic/);
    assert.match(hint, /Denver/);
  });
});

describe("missingMediaGapCopy", () => {
  it("uses Google checklist copy for AT_WORK", () => {
    const copy = missingMediaGapCopy("AT_WORK");
    assert.equal(copy.title, "Add photos of your work");
    assert.match(copy.description, /past services/i);
    assert.equal(copy.priority, "P1");
  });

  it("uses generic copy for other categories", () => {
    const copy = missingMediaGapCopy("INTERIOR");
    assert.match(copy.title, /interior/i);
    assert.equal(copy.priority, "P2");
  });
});
