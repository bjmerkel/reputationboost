import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReviewCampaignPlan,
  countCustomersMatchingKeyword,
  countReviewMentionsForKeyword,
  customerMatchesKeyword,
  prioritizeCustomersByKeyword,
} from "./campaign-plan";
import type { FullAuditPayload } from "@/audit/types";

function minimalAudit(overrides: Partial<FullAuditPayload> = {}): FullAuditPayload {
  return {
    clientName: "Northshore Learning Center",
    gbp: {
      engagement: { reviewCount: 40, averageRating: 4.8, responseRate: 0.9 },
      identity: { address: "123 Main, Las Vegas, NV", primaryCategory: "Tutoring", phone: "", secondaryCategories: [] },
      completeness: {},
      content: {},
      performance: {},
    },
    rankings: {
      keywords: [
        {
          keyword: "after school programs las vegas",
          inLocalPack: false,
          clientReviewCount: 12,
          packLeaderReviewCount: 45,
          localPackPosition: null,
          geoRanks: [],
        },
        {
          keyword: "tutoring las vegas",
          inLocalPack: true,
          clientReviewCount: 30,
          packLeaderReviewCount: 55,
          localPackPosition: 2,
          geoRanks: [],
        },
      ],
      keywordsInPack: 1,
      totalKeywords: 2,
      shareOfVoice: 50,
    },
    reviews: {
      reviews: [
        { text: "Great after school program for my kids", rating: 5, date: "2026-01-01", responded: true },
        { text: "Excellent tutoring session", rating: 5, date: "2026-02-01", responded: true },
      ],
      sentiment: { positiveThemes: [] },
      unrespondedNegative: 0,
    },
    competitors: [],
    strategy: {
      gaps: [],
      actionPlan: [],
      gbpPlan: {
        title: "",
        businessName: "",
        address: "",
        objective: "",
        targetKeywords: ["after school programs las vegas", "tutoring las vegas"],
        currentState: { fields: [], profileGaps: [] },
        keywordRankings: [
          {
            keyword: "after school programs las vegas",
            inLocalPack: false,
            position: "Outside 3-Pack",
            rankAt1Mi: 8,
            rankAt3Mi: null,
            rankAt5Mi: null,
            packLeaderReviews: 45,
            clientReviews: 12,
            reviewGap: 33,
            gbpUpdates: [],
            packFragile: false,
            weakestRadiusMiles: null,
          },
          {
            keyword: "tutoring las vegas",
            inLocalPack: true,
            position: "#2 in 3-Pack",
            rankAt1Mi: 2,
            rankAt3Mi: 2,
            rankAt5Mi: 3,
            packLeaderReviews: 55,
            clientReviews: 30,
            reviewGap: 25,
            gbpUpdates: [],
            packFragile: false,
            weakestRadiusMiles: null,
          },
        ],
        steps: [],
        keywordPriority: [],
        weeklyCadence: [],
        monthlyCadence: [],
      },
    },
    ...overrides,
  } as FullAuditPayload;
}

describe("buildReviewCampaignPlan", () => {
  it("prioritizes outside-pack keywords with actionable targets", () => {
    const plan = buildReviewCampaignPlan(minimalAudit(), { eligibleCount: 20 });

    assert.equal(plan.focusKeyword, "after school programs las vegas");
    assert.ok(plan.keywordTargets.length >= 2);
    const afterSchool = plan.keywordTargets.find((t) => t.keyword.includes("after school"));
    assert.ok(afterSchool);
    assert.ok(afterSchool!.reviewsNeeded >= 8);
    assert.match(afterSchool!.recommendation, /after school programs las vegas/i);
    assert.ok(plan.batchSize >= 10);
    assert.ok(plan.executionSteps.length >= 3);
  });

  it("tracks keyword mention progress toward targets", () => {
    const audit = minimalAudit();
    assert.equal(
      countReviewMentionsForKeyword(audit, "after school programs las vegas"),
      1
    );

    const plan = buildReviewCampaignPlan(audit, { eligibleCount: 10 });
    const afterSchool = plan.keywordTargets.find((t) => t.keyword.includes("after school"));
    assert.ok(afterSchool);
    assert.equal(afterSchool!.reviewsMentioningKeyword, 1);
    assert.ok(afterSchool!.reviewsRemaining > 0);
    assert.ok(afterSchool!.progressPercent > 0);
    assert.ok(afterSchool!.progressPercent < 100);
  });

  it("counts customers matching focus keyword via service notes", () => {
    const keyword = "after school programs las vegas";
    assert.ok(
      customerMatchesKeyword({ service_notes: "After school enrichment program" }, keyword)
    );
    assert.ok(!customerMatchesKeyword({ service_notes: "math tutoring" }, keyword));

    const count = countCustomersMatchingKeyword(
      [
        { service_notes: "after school program" },
        { service_notes: "tutoring" },
        { service_notes: null },
      ],
      keyword
    );
    assert.equal(count, 1);
  });

  it("prioritizes keyword-matched customers in batch selection order", () => {
    const keyword = "after school programs las vegas";
    const customers = [
      { service_notes: "math tutoring" },
      { service_notes: "after school enrichment" },
      { service_notes: "reading help" },
      { service_notes: "after school program" },
    ];

    const batch = prioritizeCustomersByKeyword(customers, keyword, 2);
    assert.equal(batch.length, 2);
    assert.ok(customerMatchesKeyword(batch[0], keyword));
    assert.ok(customerMatchesKeyword(batch[1], keyword));
  });
});
