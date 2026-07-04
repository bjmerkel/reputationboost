import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMediaHealthReport } from "./gbp-media-health";
import type { GbpMediaCoverage } from "./gbp-media-coverage";

function coverage(overrides: Partial<GbpMediaCoverage> = {}): GbpMediaCoverage {
  return {
    totalCount: 20,
    ownerPhotoCount: 15,
    customerPhotoCount: 5,
    hasCover: true,
    hasLogo: false,
    hasExterior: true,
    hasInterior: false,
    hasTeam: false,
    hasAtWork: true,
    hasVideo: false,
    categoryCount: 3,
    missingCategories: ["INTERIOR", "TEAMS"],
    coverageScore: 55,
    totalViews: 200,
    ownerTotalViews: 180,
    ownerAvgViews: 12,
    ownerZeroViewCount: 2,
    customerPhotoShare: 25,
    engagementScore: 60,
    daysSinceLastUpload: 45,
    ...overrides,
  };
}

describe("buildMediaHealthReport", () => {
  it("computes overall score and recommendations", () => {
    const report = buildMediaHealthReport(coverage(), { EXTERIOR: 4, AT_WORK: 3 });

    assert.ok(report.overallScore > 0 && report.overallScore <= 100);
    assert.equal(report.coverageScore, 55);
    assert.equal(report.hasVideo, false);
    assert.ok(report.recommendations.some((r) => r.includes("interior")));
    assert.ok(report.recommendations.some((r) => r.includes("video")));
    assert.equal(report.categoryStatus.find((c) => c.category === "EXTERIOR")?.filled, true);
    assert.equal(report.categoryStatus.find((c) => c.category === "INTERIOR")?.filled, false);
  });

  it("flags low engagement and stale media", () => {
    const report = buildMediaHealthReport(
      coverage({
        engagementScore: 30,
        ownerPhotoCount: 12,
        daysSinceLastUpload: 120,
      })
    );

    assert.ok(report.recommendations.some((r) => r.includes("engagement") || r.includes("low-view")));
    assert.ok(report.recommendations.some((r) => r.includes("120 days")));
  });
});
