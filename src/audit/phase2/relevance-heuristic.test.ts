import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Phase1AuditPayload } from "../types";
import { createTestAudit } from "../phase3/test-fixtures";
import {
  extractKeywordRelevanceHeuristic,
  resolveKeywordRelevance,
} from "./relevance-heuristic";
import { computeConversionScore, computeKeywordRelevanceScore } from "./scoring";

describe("extractKeywordRelevanceHeuristic", () => {
  it("scores keywords with profile coverage signals", () => {
    const audit = createTestAudit();
    const features = extractKeywordRelevanceHeuristic(audit);

    assert.equal(features.length, audit.rankings.keywords.length);
    for (const f of features) {
      assert.ok(f.score >= 0 && f.score <= 100);
      assert.ok(f.categoryFit >= 0 && f.categoryFit <= 100);
      assert.equal(f.source, "heuristic");
    }
  });

  it("raises score when keyword appears in description and services", () => {
    const base = createTestAudit();
    const enriched: Phase1AuditPayload = {
      ...base,
      gbp: {
        ...base.gbp,
        liveProfile: {
          primaryCategory: "Plumber",
          secondaryCategories: ["Emergency plumber"],
          description:
            "Dallas emergency plumber offering drain cleaning and water heater repair across the metro.",
          services: [
            {
              name: "Emergency plumber dallas",
              description: "24/7 emergency plumbing in Dallas.",
            },
            { name: "Drain cleaning", description: "Professional drain cleaning." },
          ],
          attributes: [],
          source: "oauth",
        },
      },
      reviews: {
        ...base.reviews,
        reviews: [
          {
            id: "r1",
            author: "Jane",
            rating: 5,
            text: "Best emergency plumber dallas — fixed our burst pipe fast.",
            publishedAt: "2026-06-01T00:00:00.000Z",
            responded: true,
            replyText: "Thanks!",
            replyUpdatedAt: "2026-06-02T00:00:00.000Z",
            responseTimeHours: 24,
            sentiment: "positive",
          },
        ],
      },
    };

    const target = extractKeywordRelevanceHeuristic(enriched).find(
      (f) => f.keyword === "emergency plumber dallas"
    );
    const baseline = extractKeywordRelevanceHeuristic(base).find(
      (f) => f.keyword === "emergency plumber dallas"
    );

    assert.ok(target);
    assert.ok(baseline);
    assert.ok(target.score > baseline.score);
    assert.equal(target.descriptionCoverage, true);
    assert.equal(target.servicesCoverage, true);
    assert.ok(target.reviewMentions >= 1);
    assert.ok(target.recommendation != null || target.score >= 60);
  });
});

describe("computeKeywordRelevanceScore", () => {
  it("blends relevance into conversion score", () => {
    const audit = createTestAudit();
    const relevanceOnly = computeKeywordRelevanceScore(audit);
    const conversion = computeConversionScore(audit);

    assert.ok(relevanceOnly >= 0 && relevanceOnly <= 100);
    assert.ok(conversion >= 0 && conversion <= 100);

    const cached = resolveKeywordRelevance({
      ...audit,
      keywordRelevance: extractKeywordRelevanceHeuristic(audit),
    });
    assert.equal(cached.length, audit.rankings.keywords.length);
  });
});
