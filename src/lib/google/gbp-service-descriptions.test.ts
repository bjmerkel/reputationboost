import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOutcomePriorityServiceBlocks,
  buildServicePlanBlocks,
  generateServiceDescription,
  isPlanServiceCopyBlockLabel,
  keywordToServiceName,
  missingServiceKeywords,
  parsePlanServiceBlock,
  serviceCoversKeyword,
} from "./gbp-service-descriptions";
import type { Phase1AuditPayload } from "@/audit/types";

function learningCenterAudit(): Phase1AuditPayload {
  return {
    clientId: "northshore",
    clientName: "Northshore Learning Center",
    auditId: "2026-07-08",
    trigger: "manual",
    period: "July 2026",
    startedAt: "2026-07-08T00:00:00.000Z",
    completedAt: "2026-07-08T01:00:00.000Z",
    gbp: {
      collectedAt: "2026-07-08T00:00:00.000Z",
      identity: {
        name: "Northshore Learning Center",
        address: "123 Main St, Las Vegas, NV 89101",
        phone: "(702) 555-0100",
        website: "https://northshore.example",
        primaryCategory: "Learning center",
        secondaryCategories: [],
      },
      completeness: {
        hasHours: true,
        hasFullWeekHours: true,
        hasHolidayHours: false,
        hasDescription: true,
        descriptionLength: 500,
        hasServices: true,
        serviceCount: 10,
        attributeCount: 3,
        noPendingEdits: false,
        completenessScore: 70,
      },
      content: {
        photoCount: 20,
        videoCount: 0,
        photosByType: {},
        lastPhotoUpload: null,
        postCount: 2,
        lastPostDate: "2026-06-01T00:00:00.000Z",
      },
      engagement: {
        reviewCount: 40,
        averageRating: 4.8,
        reviewsLast30Days: 2,
        reviewsLast90Days: 8,
        responseRate: 1,
        avgResponseTimeHours: 4,
      },
      performance: {
        calls: 10,
        directionRequests: 20,
        websiteClicks: 5,
        profileViews: 200,
        impressionsMaps: 400,
        impressionsSearch: 300,
        conversations: 0,
        bookings: 0,
        periodDays: 30,
      },
      issues: {
        isSuspended: false,
        isVerified: true,
        hasDuplicateListings: false,
        napInconsistencies: [],
      },
      liveProfile: {
        primaryCategory: "Learning center",
        secondaryCategories: [],
        description: "A trusted learning center in Las Vegas.",
        services: [
          { name: "Educational services", description: "Core curriculum support." },
          { name: "Field trips", description: "Community learning outings." },
          { name: "Homework assistance", description: "After-school homework help." },
          { name: "Meal preparation", description: "Healthy snacks and meals." },
        ],
        attributes: [],
        source: "oauth",
      },
    },
    rankings: {
      totalKeywords: 4,
      keywords: [
        { keyword: "northshore learning center las vegas", inLocalPack: false, localPackPosition: null, geoRanks: [], clientReviewCount: 40, packLeaderReviewCount: 80 },
        { keyword: "learning center near me", inLocalPack: true, localPackPosition: 2, geoRanks: [], clientReviewCount: 40, packLeaderReviewCount: 60 },
        { keyword: "after school programs las vegas", inLocalPack: false, localPackPosition: null, geoRanks: [], clientReviewCount: 40, packLeaderReviewCount: 70 },
        { keyword: "tutoring services las vegas", inLocalPack: false, localPackPosition: null, geoRanks: [], clientReviewCount: 40, packLeaderReviewCount: 90 },
      ],
      shareOfVoice: 25,
    },
    competitors: { competitors: [] },
    reviews: { reviews: [], sentiment: { positiveThemes: [], negativeThemes: [] }, unrespondedNegative: 0 },
    offGoogle: { citations: [], socialProfiles: [] },
  } as unknown as Phase1AuditPayload;
}

describe("gbp-service-descriptions", () => {
  it("does not treat generic 'services' token as keyword coverage", () => {
    assert.equal(serviceCoversKeyword("Educational services", "tutoring services las vegas"), false);
    assert.equal(serviceCoversKeyword("Homework assistance", "tutoring services las vegas"), false);
  });

  it("maps keywords to readable service names", () => {
    const audit = learningCenterAudit();
    assert.equal(keywordToServiceName("tutoring services las vegas", audit), "Tutoring Services");
    assert.equal(keywordToServiceName("after school programs las vegas", audit), "After School Programs");
  });

  it("generates publish-ready descriptions", () => {
    const audit = learningCenterAudit();
    const tutoring = generateServiceDescription("tutoring services las vegas", audit);
    const enrichment = generateServiceDescription("after school programs las vegas", audit);

    assert.match(tutoring, /Personalized tutoring sessions/i);
    assert.match(enrichment, /Engaging enrichment programs/i);
    assert.doesNotMatch(tutoring, /Add "/);
  });

  it("builds deduplicated plan blocks for uncovered keywords", () => {
    const audit = learningCenterAudit();
    const blocks = buildServicePlanBlocks(audit);

    assert.ok(blocks.length >= 2);
    assert.ok(blocks.some((b) => /Tutoring Services/i.test(b.serviceName)));
    assert.ok(blocks.some((b) => /After School|Enrichment|Program/i.test(b.serviceName)));
    assert.ok(blocks.every((b) => b.content.length > 40));
  });

  it("lists missing keywords without false positives", () => {
    const keywords = [
      "tutoring services las vegas",
      "after school programs las vegas",
      "learning center near me",
    ];
    const existing = ["Educational services", "Homework assistance", "Field trips"];
    const missing = missingServiceKeywords(keywords, existing);

    assert.ok(missing.includes("tutoring services las vegas"));
    assert.ok(missing.includes("after school programs las vegas"));
    assert.ok(missing.includes("learning center near me"));
  });

  it("parses legacy product description labels into service fields", () => {
    const audit = learningCenterAudit();
    const label = "Product Description for HVAC Air Conditioning Heating Repair Near Newark NJ";
    const content =
      "Wayne Refrigeration Air and Heat specializes in HVAC air conditioning and heating repair services near Newark, NJ.";

    assert.equal(isPlanServiceCopyBlockLabel(label), true);
    const parsed = parsePlanServiceBlock(label, content, audit);
    assert.ok(parsed.serviceName.length > 0);
    assert.ok(parsed.serviceName.length <= 140);
    assert.equal(parsed.serviceDescription, content);
    assert.match(parsed.keyword ?? "", /hvac air conditioning/i);
  });

  it("parses standard service block labels", () => {
    const audit = learningCenterAudit();
    const parsed = parsePlanServiceBlock(
      "Service #1: Tutoring Services",
      "Personalized tutoring sessions for Las Vegas students.",
      audit
    );

    assert.equal(parsed.serviceName, "Tutoring Services");
    assert.match(parsed.serviceDescription, /Personalized tutoring/i);
  });

  it("builds priority keyword service blocks for outside-pack terms", () => {
    const audit = learningCenterAudit();
    const blocks = buildOutcomePriorityServiceBlocks(audit);

    assert.ok(blocks.length >= 2);
    assert.ok(blocks.every((block) => /^Service #\d+:/.test(block.label)));
    assert.ok(blocks.every((block) => block.content.length <= 250));
  });
});
