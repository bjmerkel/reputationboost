import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FullAuditPayload } from "@/audit/types";
import { buildCategoryBatchUploadJobs } from "./gbp-media-batch";

function auditWithCoverage(missingCategories: string[]): FullAuditPayload {
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
        photoCount: 12,
        videoCount: 0,
        photosByType: {},
        lastPhotoUpload: null,
        postCount: 0,
        lastPostDate: null,
        mediaCoverage: {
          totalCount: 12,
          ownerPhotoCount: 10,
          customerPhotoCount: 2,
          hasCover: false,
          hasLogo: false,
          hasExterior: !missingCategories.includes("EXTERIOR"),
          hasInterior: !missingCategories.includes("INTERIOR"),
          hasTeam: !missingCategories.includes("TEAMS"),
          hasAtWork: !missingCategories.includes("AT_WORK"),
          hasVideo: false,
          categoryCount: 2,
          missingCategories,
          coverageScore: 40,
          totalViews: 50,
          ownerTotalViews: 40,
          ownerAvgViews: 4,
          ownerZeroViewCount: 3,
          customerPhotoShare: 17,
          engagementScore: 35,
          daysSinceLastUpload: 120,
          photoViewsAvailable: true,
        },
      },
    },
  } as unknown as FullAuditPayload;
}

describe("buildCategoryBatchUploadJobs", () => {
  it("returns jobs for each missing recommended category", () => {
    const jobs = buildCategoryBatchUploadJobs(
      auditWithCoverage(["INTERIOR", "TEAMS"])
    );

    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].category, "INTERIOR");
    assert.equal(jobs[1].category, "TEAMS");
    assert.match(jobs[0].hint, /workspace/i);
  });

  it("returns empty list when coverage is complete", () => {
    const jobs = buildCategoryBatchUploadJobs(auditWithCoverage([]));
    assert.equal(jobs.length, 0);
  });

  it("prioritizes AT_WORK when that category is missing", () => {
    const jobs = buildCategoryBatchUploadJobs(
      auditWithCoverage(["AT_WORK", "INTERIOR", "TEAMS"])
    );

    assert.equal(jobs[0].category, "AT_WORK");
    assert.equal(jobs[0].title, "Add photos of your work");
    assert.match(jobs[0].hint, /on-site|before\/after/i);
  });
});
