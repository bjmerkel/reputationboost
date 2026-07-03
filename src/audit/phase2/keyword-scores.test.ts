import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { buildAttributionCalibration } from "./attribution-calibration";
import { computeKeywordScores } from "./keyword-scores";
import { buildPathToHealthy } from "./path-to-healthy";
import { createTestAudit } from "../phase3/test-fixtures";

describe("computeKeywordScores", () => {
  it("returns sorted keyword cards with visibility and actions", () => {
    const audit = createTestAudit();
    const cards = computeKeywordScores(audit);

    assert.equal(cards.length, audit.rankings.keywords.length);
    for (const card of cards) {
      assert.ok(card.keyword.length > 0);
      assert.ok(card.visibilityScore >= 0 && card.visibilityScore <= 100);
      assert.ok(card.relevanceScore >= 0 && card.relevanceScore <= 100);
      assert.ok(card.suggestedAction.length > 0);
      assert.ok(card.positionLabel.length > 0);
    }
    // Outside-pack keywords should rank as higher opportunity
    const outside = cards.filter((c) => !c.inLocalPack);
    const inside = cards.filter((c) => c.inLocalPack);
    if (outside.length > 0 && inside.length > 0) {
      assert.ok(outside[0].visibilityScore <= inside[inside.length - 1].visibilityScore);
    }
  });

  it("estimates revenue when avg customer value is set", () => {
    const audit = createTestAudit();
    const withRevenue = computeKeywordScores(audit, {
      avgCustomerValue: 350,
      currency: "USD",
    });

    const withImpressions = withRevenue.find((c) => c.impressions != null);
    if (withImpressions) {
      assert.ok(withImpressions.estimatedMonthlyRevenue != null);
      assert.ok(withImpressions.potentialAtRank1 != null);
      assert.ok(withImpressions.potentialAtRank1! >= withImpressions.estimatedMonthlyRevenue!);
    }
  });
});

describe("buildPathToHealthy", () => {
  it("builds a path when score is below 70", () => {
    const audit = createTestAudit();
    const path = buildPathToHealthy(audit);

    assert.ok(path);
    assert.ok(path!.currentScore < 70);
    assert.ok(path!.pointsNeeded > 0);
    assert.ok(path!.projectedScore >= path!.currentScore);
    assert.ok(path!.steps.length > 0);
    assert.equal(path!.alreadyHealthy, false);
    assert.ok(path!.topKeywords.length > 0);
  });

  it("calibrates step impacts from attributions", () => {
    const attributions: ActionAttribution[] = [
      {
        id: "a1",
        executionTaskId: "t1",
        businessId: "b1",
        taskType: "gbp_description",
        actionItemId: "gbp-step-3",
        title: "Description",
        publishedAt: "2026-06-01T00:00:00.000Z",
        windowDays: 14,
        primaryKeyword: "emergency plumber dallas",
        rankBefore: 8,
        rankAfter: 4,
        rankDelta: -4,
        keywordsImproved: 1,
        callsDelta: 6,
        directionsDelta: null,
        websiteClicksDelta: null,
        impressionsDelta: null,
        estimatedRevenue: 1200,
        narrative: "Improved",
        preliminary: false,
        computedAt: "2026-06-15T00:00:00.000Z",
      },
      {
        id: "a2",
        executionTaskId: "t2",
        businessId: "b1",
        taskType: "gbp_description",
        actionItemId: "gbp-step-3",
        title: "Description",
        publishedAt: "2026-05-01T00:00:00.000Z",
        windowDays: 14,
        primaryKeyword: "drain cleaning dallas",
        rankBefore: 10,
        rankAfter: 6,
        rankDelta: -4,
        keywordsImproved: 1,
        callsDelta: 3,
        directionsDelta: null,
        websiteClicksDelta: null,
        impressionsDelta: null,
        estimatedRevenue: 800,
        narrative: "Improved",
        preliminary: false,
        computedAt: "2026-05-15T00:00:00.000Z",
      },
    ];

    const calibration = buildAttributionCalibration(attributions);
    assert.ok(calibration[3]);
    assert.equal(calibration[3].sampleSize, 2);
    assert.ok(calibration[3].estimatedScoreImpact >= 1);
  });
});
