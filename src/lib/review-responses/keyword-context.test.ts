import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FullAuditPayload, ReviewRecord } from "@/audit/types";
import {
  assignReviewResponseKeywordContexts,
  buildKeywordPromptBlock,
  extractAreaToken,
  extractServiceTokens,
  resolveReviewResponseKeywordContext,
} from "./keyword-context";
import {
  assessKeywordWeaveQuality,
  isForcedExactPhrase,
  keywordsHitInText,
} from "./keyword-quality";
import { buildReviewResponseKeywordPayload } from "./payload";

function review(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "r1",
    rating: 5,
    text: "Great oil change, fast service",
    author: "Jane Doe",
    publishedAt: "2026-01-01T00:00:00.000Z",
    responded: false,
    sentiment: "positive",
    responseTimeHours: null,
    ...overrides,
  };
}

function minimalAudit(overrides: Partial<FullAuditPayload> = {}): FullAuditPayload {
  return {
    clientName: "Quick Lube",
    gbp: {
      engagement: { reviewCount: 40, averageRating: 4.8, responseRate: 0.9 },
      identity: {
        address: "123 Main St, Arlington, VA",
        primaryCategory: "Oil change service",
        phone: "555-0100",
        secondaryCategories: [],
      },
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
        {
          keyword: "brake repair arlington",
          inLocalPack: true,
          clientReviewCount: 20,
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
      reviews: [review()],
      sentiment: { positiveThemes: [], negativeThemes: [], praiseCount: 1, complaintCount: 0, neutralCount: 0 },
      unrespondedNegative: 0,
      disputeCandidates: [],
      velocityVsPriorMonth: 0,
      avgResponseTimeHours: null,
      collectedAt: "2026-01-01T00:00:00.000Z",
    },
    competitors: [],
    strategy: {
      gbpPlan: {
        targetKeywords: ["oil change arlington va", "brake repair arlington"],
        keywordRankings: [
          { keyword: "oil change arlington va", inLocalPack: false, reviewGap: 40, clientReviews: 2, packLeaderReviews: 42 },
          { keyword: "brake repair arlington", inLocalPack: true, reviewGap: 5, clientReviews: 20, packLeaderReviews: 25 },
        ],
      },
    },
    ...overrides,
  } as FullAuditPayload;
}

describe("keyword-context", () => {
  it("extracts area and service tokens", () => {
    assert.equal(extractAreaToken("123 Main St, Arlington, VA"), "Arlington");
    assert.deepEqual(extractServiceTokens("oil change arlington va"), ["change", "arlington"]);
  });

  it("suggests keyword when review mentions service tokens", () => {
    const audit = minimalAudit();
    const context = resolveReviewResponseKeywordContext(audit, review());

    assert.equal(context.suggestedKeyword, "oil change arlington va");
    assert.equal(context.reason, "review_mentions_service");
    assert.ok(context.weaveHints.some((hint) => hint.includes("customer mentioned")));
  });

  it("skips keyword weave for negative reviews", () => {
    const audit = minimalAudit();
    const context = resolveReviewResponseKeywordContext(
      audit,
      review({ rating: 1, text: "Terrible oil change", sentiment: "negative" })
    );

    assert.equal(context.suggestedKeyword, null);
    assert.equal(context.skipReason, "negative_review");
  });

  it("builds optional keyword prompt block", () => {
    const audit = minimalAudit();
    const context = resolveReviewResponseKeywordContext(audit, review());
    const block = buildKeywordPromptBlock(context);

    assert.match(block, /KEYWORD OPPORTUNITY/);
    assert.match(block, /optional/i);
    assert.doesNotMatch(block, /mandatory/i);
  });

  it("rotates keywords across a batch of positive reviews", () => {
    const audit = minimalAudit({
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
          {
            keyword: "transmission repair arlington",
            inLocalPack: false,
            clientReviewCount: 1,
            packLeaderReviewCount: 40,
            localPackPosition: null,
            geoRanks: [],
          },
        ],
        keywordsInPack: 0,
        totalKeywords: 2,
        shareOfVoice: 0,
      },
      strategy: {
        gbpPlan: {
          targetKeywords: ["oil change arlington va", "transmission repair arlington"],
          keywordRankings: [
            {
              keyword: "oil change arlington va",
              inLocalPack: false,
              reviewGap: 40,
              clientReviews: 2,
              packLeaderReviews: 42,
            },
            {
              keyword: "transmission repair arlington",
              inLocalPack: false,
              reviewGap: 35,
              clientReviews: 1,
              packLeaderReviews: 36,
            },
          ],
        },
      },
      reviews: {
        ...minimalAudit().reviews,
        reviews: [
          review({ id: "r1", text: "Wonderful staff" }),
          review({ id: "r2", text: "Always friendly" }),
          review({ id: "r3", text: "Highly recommend" }),
        ],
      },
    });

    const contexts = assignReviewResponseKeywordContexts(audit, audit.reviews.reviews);
    const suggested = [...contexts.values()]
      .map((context) => context.suggestedKeyword)
      .filter(Boolean);

    assert.ok(suggested.length >= 2);
  });

  it("boosts active campaign keywords", () => {
    const audit = minimalAudit({
      reviews: {
        ...minimalAudit().reviews,
        reviews: [review({ text: "Wonderful staff" })],
      },
    });

    const withoutCampaign = resolveReviewResponseKeywordContext(audit, review({ text: "Wonderful staff" }));
    const withCampaign = resolveReviewResponseKeywordContext(audit, review({ text: "Wonderful staff" }), {
      activeCampaignKeywords: ["oil change arlington va"],
    });

    assert.equal(withoutCampaign.suggestedKeyword, null);
    assert.equal(withCampaign.suggestedKeyword, "oil change arlington va");
    assert.equal(withCampaign.activeCampaignKeyword, "oil change arlington va");
  });
});

describe("keyword-quality", () => {
  it("detects forced long-tail phrases", () => {
    assert.equal(
      isForcedExactPhrase(
        "Thanks for visiting us for oil change arlington va!",
        "oil change arlington va",
        "Great service"
      ),
      true
    );
    assert.equal(
      isForcedExactPhrase(
        "Thanks for the oil change!",
        "oil change arlington va",
        "Great oil change"
      ),
      false
    );
  });

  it("flags stuffing when too many keyword concepts appear", () => {
    const audit = minimalAudit({
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
          {
            keyword: "brake repair arlington",
            inLocalPack: true,
            clientReviewCount: 20,
            packLeaderReviewCount: 55,
            localPackPosition: 2,
            geoRanks: [],
          },
          {
            keyword: "transmission repair arlington",
            inLocalPack: false,
            clientReviewCount: 1,
            packLeaderReviewCount: 40,
            localPackPosition: null,
            geoRanks: [],
          },
        ],
        keywordsInPack: 1,
        totalKeywords: 3,
        shareOfVoice: 33,
      },
    });
    const context = resolveReviewResponseKeywordContext(audit, review());
    const keywords = audit.rankings.keywords.map((row) => row.keyword);
    const stuffed =
      "Thanks for the oil change, brake repair, and transmission work — we love serving Arlington neighbors.";
    const quality = assessKeywordWeaveQuality(stuffed, review().text, context, keywords);

    assert.equal(quality.stuffing, true);
    assert.equal(quality.regenRecommended, true);
  });

  it("builds payload with keywords hit", () => {
    const audit = minimalAudit();
    const context = resolveReviewResponseKeywordContext(audit, review());
    const payload = buildReviewResponseKeywordPayload(
      "Thanks Jane! Glad our oil change team could help.",
      review().text,
      context,
      audit.rankings.keywords.map((row) => row.keyword)
    );

    assert.ok(Array.isArray(payload.keywordsHit));
    assert.equal(payload.weaveSkipped, false);
  });

  it("matches keyword concepts with token overlap", () => {
    const hits = keywordsHitInText(
      "Thanks for trusting us with your oil change!",
      ["oil change arlington va"]
    );
    assert.deepEqual(hits, ["oil change arlington va"]);
  });
});
