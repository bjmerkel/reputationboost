import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProductPlaybook } from "./product-playbook";
import type { FullAuditPayload } from "@/audit/types";

function minimalAudit(overrides: Partial<FullAuditPayload> = {}): FullAuditPayload {
  return {
    clientId: "c1",
    clientName: "Test Biz",
    auditId: "a1",
    trigger: "manual",
    period: "2026-07",
    startedAt: "2026-07-01T00:00:00.000Z",
    completedAt: new Date().toISOString(),
    gbp: {
      collectedAt: "2026-07-01T00:00:00.000Z",
      identity: { name: "Test", address: "1 Main", phone: "555", website: null, primaryCategory: "Plumber", secondaryCategories: [] },
      completeness: {
        hasHours: true,
        hasFullWeekHours: true,
        hasHolidayHours: false,
        hasDescription: true,
        descriptionLength: 100,
        hasServices: true,
        serviceCount: 1,
        attributeCount: 0,
        noPendingEdits: true,
        completenessScore: 50,
      },
      content: { photoCount: 1, videoCount: 0, photosByType: {}, lastPhotoUpload: null, postCount: 0, lastPostDate: null },
      engagement: { reviewCount: 10, averageRating: 4.5, reviewsLast30Days: 1, reviewsLast90Days: 3, responseRate: 0.8, avgResponseTimeHours: 24 },
      performance: { source: "api", accessCheck: { severity: "ok", message: "ok" }, searchKeywords: [], warnings: [] },
    },
    rankings: { keywords: [] },
    competitors: [],
    reviews: { unrespondedNegative: 0, pendingReplies: [], reviews: [], disputeCandidates: [] },
    strategy: {
      scores: { overall: 55, grade: "needs_work", drivers: {}, outcomes: {} },
      gaps: [],
      gbpPlan: null,
      executiveSummary: "",
      monthlyReport: null,
    },
    execution: {
      generatedAt: "2026-07-01T00:00:00.000Z",
      tasksCreated: 1,
      pendingApproval: 1,
      autoApproved: 0,
      tasks: [
        {
          id: "t1",
          clientId: "c1",
          auditId: "a1",
          type: "gbp_description",
          title: "Update description",
          status: "pending_approval",
          priority: "P1",
          draftContent: "Hello",
          payload: {},
          scheduledFor: null,
          approvedAt: null,
          completedAt: null,
          result: null,
          createdAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    },
    ...overrides,
  } as FullAuditPayload;
}

describe("buildProductPlaybook", () => {
  it("prioritizes GBP connection when not connected", () => {
    const playbook = buildProductPlaybook({
      gbpConnected: false,
      audit: null,
      tasks: [],
    });

    assert.equal(playbook.stage, "setup");
    assert.equal(playbook.nextItem?.id, "connect-gbp");
    assert.ok(playbook.pendingCount >= 1);
  });

  it("prioritizes first audit when connected but no audit", () => {
    const playbook = buildProductPlaybook({
      gbpConnected: true,
      audit: null,
      tasks: [],
    });

    assert.equal(playbook.stage, "launch");
    assert.equal(playbook.nextItem?.id, "run-first-audit");
  });

  it("surfaces plan approvals when tasks are pending", () => {
    const audit = minimalAudit();
    const playbook = buildProductPlaybook({
      gbpConnected: true,
      audit,
      tasks: audit.execution!.tasks,
      avgCustomerValue: 500,
    });

    assert.equal(playbook.stage, "execute");
    assert.equal(playbook.nextItem?.action, "review_approvals");
  });

  it("surfaces work-photo checklist item when AT_WORK is missing", () => {
    const audit = minimalAudit({
      gbp: {
        ...minimalAudit().gbp,
        content: {
          ...minimalAudit().gbp.content,
          mediaCoverage: {
            totalCount: 5,
            ownerPhotoCount: 5,
            customerPhotoCount: 0,
            hasCover: false,
            hasLogo: false,
            hasExterior: true,
            hasInterior: true,
            hasTeam: true,
            hasAtWork: false,
            hasVideo: false,
            categoryCount: 3,
            missingCategories: ["AT_WORK"],
            coverageScore: 60,
            totalViews: 0,
            ownerTotalViews: 0,
            ownerAvgViews: 0,
            ownerZeroViewCount: 0,
            customerPhotoShare: 0,
            engagementScore: 50,
            daysSinceLastUpload: 10,
            photoViewsAvailable: false,
          },
        },
      },
      execution: {
        generatedAt: "2026-07-01T00:00:00.000Z",
        tasksCreated: 0,
        pendingApproval: 0,
        autoApproved: 0,
        tasks: [],
      },
    });

    const playbook = buildProductPlaybook({
      gbpConnected: true,
      audit,
      tasks: [],
      avgCustomerValue: 500,
    });

    const workPhotos = playbook.items.find((item) => item.id === "add-work-photos");
    assert.ok(workPhotos);
    assert.equal(workPhotos?.title, "Add photos of your work");
    assert.equal(workPhotos?.planStepNumber, 6);
    assert.equal(workPhotos?.status, "pending");
  });

  it("uses category-appropriate ROI playbook title", () => {
    const playbook = buildProductPlaybook({
      gbpConnected: true,
      audit: null,
      tasks: [],
      industry: "Dog groomer",
    });
    const roiItem = playbook.items.find((item) => item.id === "set-roi");
    assert.match(roiItem?.title ?? "", /visit value/i);
  });

  it("surfaces review campaign plan for connected businesses with an audit", () => {
    const audit = minimalAudit({
      rankings: {
        keywords: [],
        keywordsInPack: 3,
        totalKeywords: 3,
      },
      strategy: {
        ...minimalAudit().strategy,
        gbpPlan: {
          title: "Plan",
          businessName: "Test Biz",
          address: "1 Main",
          objective: "Grow",
          targetKeywords: ["plumber"],
          currentState: {
            reviewCount: 10,
            averageRating: 4.5,
            photoCount: 5,
            postCount: 0,
            completenessScore: 50,
          },
          keywordRankings: [],
          steps: [
            {
              stepNumber: 10,
              title: "Request more reviews",
              instruction: "Send SMS review requests.",
            },
          ],
          keywordPriority: [],
          weeklyCadence: [],
          monthlyCadence: [],
        },
      },
      execution: {
        generatedAt: "2026-07-01T00:00:00.000Z",
        tasksCreated: 0,
        pendingApproval: 0,
        autoApproved: 0,
        tasks: [],
      },
    });

    const playbook = buildProductPlaybook({
      gbpConnected: true,
      audit,
      tasks: [],
      avgCustomerValue: 500,
    });

    const item = playbook.items.find((entry) => entry.id === "review-campaign-plan");
    assert.ok(item, "expected review-campaign-plan in playbook");
    assert.equal(item?.title, "Review campaign plan");
    assert.equal(item?.planStepNumber, 10);
    assert.equal(item?.action, "open_plan");
  });

  it("keeps Profile Guide setup pending until published", () => {
    const playbook = buildProductPlaybook({
      gbpConnected: true,
      audit: minimalAudit(),
      tasks: [],
      profileGuidePublished: false,
    });

    const item = playbook.items.find((entry) => entry.id === "setup-profile-guide");
    assert.ok(item);
    assert.equal(item?.status, "pending");
  });
});
