import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FullAuditPayload, ReviewRecord } from "@/audit/types";
import { generateReviewResponses } from "./content";
import { resolveReviewResponseKeywordContext } from "@/lib/review-responses/keyword-context";

const ANNE_REVIEW =
  "My son has been going here since May of 2019. When he started he was very shy, very closed off and very nervous of other people. Since attending North Shore, he has become more outgoing, is caught up to where he needs to be academically, and is overall just a happier kid. He went into the pre-K program and was set up for success to enter kindergarten. He now goes to North Shore for the before, and after school program, and it really is his happy place after a long day of kindergarten. He enjoys being there and has always been welcomed with open arms. There is no other preschool or childcare center I will ever recommend to anyone other than Northshore! Thank you to everyone at northshore, especially the teachers who have shown nothing but patience and love for my son!";

function review(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "anne-review",
    rating: 5,
    text: ANNE_REVIEW,
    author: "Anne Cardona",
    publishedAt: "2026-07-11T02:01:00.000Z",
    responded: false,
    sentiment: "positive",
    responseTimeHours: null,
    ...overrides,
  };
}

function northshoreAudit(overrides: Partial<FullAuditPayload> = {}): FullAuditPayload {
  return {
    clientName: "Northshore Learning Center",
    gbp: {
      engagement: { reviewCount: 62, averageRating: 4.4, responseRate: 0.8 },
      identity: {
        address: "123 Lake Mead Blvd, Las Vegas, NV 89129",
        primaryCategory: "Day care center",
        phone: "702-555-0100",
        secondaryCategories: ["Preschool"],
      },
      completeness: {},
      content: {},
      performance: {},
    },
    rankings: {
      keywords: [
        {
          keyword: "learning center near me",
          inLocalPack: false,
          clientReviewCount: 5,
          packLeaderReviewCount: 40,
          localPackPosition: null,
          geoRanks: [],
        },
        {
          keyword: "daycare near las vegas",
          inLocalPack: false,
          clientReviewCount: 3,
          packLeaderReviewCount: 35,
          localPackPosition: null,
          geoRanks: [],
        },
      ],
      keywordsInPack: 0,
      totalKeywords: 2,
      shareOfVoice: 0,
    },
    reviews: {
      reviews: [review()],
      sentiment: {
        positiveThemes: ["teachers", "happy place"],
        negativeThemes: [],
        praiseCount: 1,
        complaintCount: 0,
        neutralCount: 0,
      },
      unrespondedNegative: 0,
      disputeCandidates: [],
      velocityVsPriorMonth: 0,
      avgResponseTimeHours: null,
      collectedAt: "2026-07-11T02:01:00.000Z",
    },
    competitors: [],
    strategy: {
      gbpPlan: {
        targetKeywords: ["learning center near me", "daycare near las vegas"],
        keywordRankings: [
          {
            keyword: "learning center near me",
            inLocalPack: false,
            reviewGap: 35,
            clientReviews: 5,
            packLeaderReviews: 40,
          },
          {
            keyword: "daycare near las vegas",
            inLocalPack: false,
            reviewGap: 32,
            clientReviews: 3,
            packLeaderReviews: 35,
          },
        ],
      },
    },
    ...overrides,
  } as FullAuditPayload;
}

describe("generateReviewResponses templates", () => {
  it("does not paste a long narrative review into the reply mid-sentence", () => {
    const drafts = generateReviewResponses(northshoreAudit());
    assert.equal(drafts.length, 1);

    const response = drafts[0].response;
    assert.match(response, /^Thank you so much, Anne!/);
    assert.doesNotMatch(response, /We're glad my son has been going here/i);
    assert.doesNotMatch(response, /meant a lot to you/i);
    assert.doesNotMatch(response, /…/);
    assert.doesNotMatch(response, /when he started he was very shy/i);
  });

  it("weaves a natural service phrase instead of a raw SEO token", () => {
    const drafts = generateReviewResponses(northshoreAudit());
    const response = drafts[0].response;

    assert.match(response, /Las Vegas neighbors with learning center/i);
    assert.doesNotMatch(response, /neighbors with learning(?!\s+center)/i);
    assert.doesNotMatch(response, /learning center near me/i);
  });

  it("still embeds short impersonal praise when it fits naturally", () => {
    const audit = northshoreAudit({
      reviews: {
        ...northshoreAudit().reviews,
        reviews: [
          review({
            id: "short",
            author: "Jamie Lee",
            text: "Wonderful teachers and a caring staff!",
          }),
        ],
      },
    });

    const response = generateReviewResponses(audit)[0].response;
    assert.match(response, /We're so glad to hear "Wonderful teachers and a caring staff"/);
    assert.match(response, /learning center/i);
  });

  it("does not treat a lone 'center' mention as the customer naming the SEO keyword", () => {
    const context = resolveReviewResponseKeywordContext(
      northshoreAudit(),
      review()
    );

    assert.notEqual(context.reason, "review_mentions_service");
  });
});
