import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeHealthScores, computeVisibilityScore, positionVisibilityScore } from "./scoring";
import { gapScoreImpact } from "./score-impact";
import { detectGaps } from "./gaps";
import { createTestAudit } from "../phase3/test-fixtures";

describe("positionVisibilityScore", () => {
  it("maps pack positions to visibility points", () => {
    assert.equal(positionVisibilityScore(1), 100);
    assert.equal(positionVisibilityScore(2), 75);
    assert.equal(positionVisibilityScore(3), 50);
    assert.equal(positionVisibilityScore("not_in_pack"), 0);
    assert.ok(positionVisibilityScore(8) < positionVisibilityScore(4));
  });
});

describe("computeHealthScores", () => {
  it("returns component scores and overall blend", () => {
    const audit = createTestAudit();
    const scores = computeHealthScores(audit);

    assert.ok(scores.overall >= 0 && scores.overall <= 100);
    assert.ok(scores.visibility >= 0 && scores.visibility <= 100);
    assert.ok(scores.conversion >= 0 && scores.conversion <= 100);
    assert.ok(scores.revenueCapture >= 0 && scores.revenueCapture <= 100);
    assert.equal(
      scores.overall,
      Math.round(scores.visibility * 0.5 + scores.conversion * 0.3 + scores.revenueCapture * 0.2)
    );
    assert.ok(scores.insight.nextAction);
    assert.ok(scores.engagementOutcomes.calls > 0);
  });

  it("weights visibility by rank depth, not just in-pack binary", () => {
    const audit = createTestAudit();
    const visibility = computeVisibilityScore(audit);
    // 1 of 3 keywords in pack at #3 — weighted visibility should be below 50
    assert.ok(visibility < 50);
    assert.ok(visibility > 0);
  });

  it("does not use engagement volume as a score input", () => {
    const audit = createTestAudit();
    const base = computeHealthScores(audit);
    const inflated = computeHealthScores({
      ...audit,
      gbp: {
        ...audit.gbp,
        performance: {
          ...audit.gbp.performance,
          calls: 9999,
          directionRequests: 9999,
          websiteClicks: 9999,
          profileViews: 99999,
        },
      },
    });
    assert.equal(base.overall, inflated.overall);
    assert.ok(inflated.engagementOutcomes.calls === 9999);
  });
});

describe("gap score impact", () => {
  it("tags gaps with score component and impact", () => {
    const audit = createTestAudit();
    const gaps = detectGaps(audit);
    assert.ok(gaps.length > 0);
    for (const gap of gaps) {
      assert.ok(gap.scoreComponent);
      assert.ok(gap.scoreImpact != null && gap.scoreImpact > 0);
    }
    const rankGap = gaps.find((g) => g.id.startsWith("rank-outside-pack"));
    assert.ok(rankGap);
    assert.equal(rankGap!.scoreComponent, "visibility");
    assert.ok(gapScoreImpact(rankGap!) >= 8);
  });
});
