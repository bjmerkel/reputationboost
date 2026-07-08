import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReviewRecord } from "@/audit/types";
import { resolveRegenerateKeywordContext } from "./regenerate";

function review(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "r1",
    rating: 5,
    text: "Great visit",
    author: "Jane Doe",
    publishedAt: "2026-01-01T00:00:00.000Z",
    responded: false,
    sentiment: "positive",
    responseTimeHours: null,
    ...overrides,
  };
}

function minimalAudit() {
  return {
    clientName: "Quick Lube",
    gbp: {
      identity: {
        address: "123 Main St, Arlington, VA",
        primaryCategory: "Oil change service",
        phone: "555-0100",
        secondaryCategories: [],
      },
      engagement: { reviewCount: 40, averageRating: 4.8, responseRate: 0.9 },
      completeness: {},
      content: {},
      performance: {},
    },
    rankings: {
      keywords: [
        {
          keyword: "oil change arlington va",
          inLocalPack: false,
          clientReviewCount: 2,
          packLeaderReviewCount: 45,
          localPackPosition: null,
          geoRanks: [],
        },
      ],
      keywordsInPack: 0,
      totalKeywords: 1,
      shareOfVoice: 0,
    },
    reviews: { reviews: [review()] },
    strategy: {
      gbpPlan: {
        targetKeywords: ["oil change arlington va"],
        keywordRankings: [
          {
            keyword: "oil change arlington va",
            inLocalPack: false,
            reviewGap: 40,
            clientReviews: 2,
            packLeaderReviews: 42,
          },
        ],
      },
    },
  } as import("@/audit/types").FullAuditPayload;
}

describe("regenerate review response", () => {
  it("forces weave when weaveKeyword is true", () => {
    const audit = minimalAudit();
    const context = resolveRegenerateKeywordContext(audit, review(), {
      weaveKeyword: true,
      fallbackKeyword: "oil change arlington va",
    });

    assert.equal(context.suggestedKeyword, "oil change arlington va");
    assert.ok(context.weaveHints.length > 0);
  });

  it("uses explicit keyword when provided", () => {
    const audit = minimalAudit();
    const context = resolveRegenerateKeywordContext(audit, review(), {
      keyword: "oil change arlington va",
      activeCampaignKeywords: ["oil change arlington va"],
    });

    assert.equal(context.reason, "active_campaign");
    assert.equal(context.activeCampaignKeyword, "oil change arlington va");
  });
});
