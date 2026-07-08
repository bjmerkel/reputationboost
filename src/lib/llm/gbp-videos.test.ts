import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FullAuditPayload } from "@/audit/types";
import { buildTemplateVideoJobs } from "./gbp-videos";

function auditWithoutVideo(): FullAuditPayload {
  return {
    auditId: "a1",
    clientName: "Test Co",
    gbp: {
      identity: {
        name: "Test Co",
        address: "123 Main St, Austin, TX 78701",
        primaryCategory: "Plumber",
      },
      content: {
        photoCount: 10,
        videoCount: 0,
        photosByType: {},
        lastPhotoUpload: null,
        postCount: 0,
        lastPostDate: null,
        mediaCoverage: {
          totalCount: 10,
          ownerPhotoCount: 8,
          customerPhotoCount: 2,
          hasCover: false,
          hasLogo: false,
          hasExterior: true,
          hasInterior: true,
          hasTeam: false,
          hasAtWork: true,
          hasVideo: false,
          categoryCount: 3,
          missingCategories: [],
          coverageScore: 70,
          totalViews: 100,
          ownerTotalViews: 90,
          ownerAvgViews: 11,
          ownerZeroViewCount: 1,
          customerPhotoShare: 20,
          engagementScore: 65,
          daysSinceLastUpload: 20,
          photoViewsAvailable: true,
        },
      },
    },
    rankings: {
      keywords: [{ keyword: "emergency plumber", inLocalPack: false, localPackPosition: 5 }],
    },
  } as unknown as FullAuditPayload;
}

describe("buildTemplateVideoJobs", () => {
  it("creates video jobs when profile has no videos", () => {
    const jobs = buildTemplateVideoJobs(auditWithoutVideo());
    assert.ok(jobs.length >= 1);
    assert.equal(jobs[0].category, "AT_WORK");
    assert.match(jobs[0].hint, /30/i);
  });

  it("returns empty when videos already exist", () => {
    const audit = auditWithoutVideo();
    audit.gbp.content.mediaCoverage!.hasVideo = true;
    assert.equal(buildTemplateVideoJobs(audit).length, 0);
  });
});
