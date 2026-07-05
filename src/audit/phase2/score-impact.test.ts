import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "../phase3/test-fixtures";
import { detectGaps } from "./gaps";
import {
  gapOutcomeScoreImpact,
  gapQualifiesForPool,
  gapRevenueImpact,
} from "./score-impact";
import { buildPathToHealthy } from "./path-to-healthy";

describe("gap outcome and revenue impact", () => {
  it("qualifies rank-outside-pack gaps for the path pool", () => {
    const audit = createTestAudit();
    const rankGap = detectGaps(audit).find((g) => g.id.startsWith("rank-outside-pack-"));
    assert.ok(rankGap);
    assert.equal(gapQualifiesForPool(rankGap!, audit), true);
    assert.ok(gapOutcomeScoreImpact(rankGap!, audit) > 0);
  });

  it("estimates revenue impact for rank gaps when ACV is set", () => {
    const audit = createTestAudit();
    const withKeywords = {
      ...audit,
      gbp: {
        ...audit.gbp,
        performance: {
          ...audit.gbp.performance,
          searchKeywords: audit.rankings.keywords.map((kw) => ({
            keyword: kw.keyword,
            impressions: 700,
            belowThreshold: false,
          })),
        },
      },
    };
    const rankGap = detectGaps(withKeywords).find((g) =>
      g.id.startsWith("rank-outside-pack-")
    );
    assert.ok(rankGap);
    const revenue = gapRevenueImpact(rankGap!, withKeywords, 350);
    assert.ok(revenue != null);
    assert.ok(revenue! > 0);
  });
});

describe("buildPathToHealthy rank gap pool", () => {
  it("can select a rank-outside-pack gap in revenue mode", () => {
    const audit = createTestAudit();
    const withKeywords = {
      ...audit,
      gbp: {
        ...audit.gbp,
        performance: {
          ...audit.gbp.performance,
          searchKeywords: audit.rankings.keywords.map((kw) => ({
            keyword: kw.keyword,
            impressions: 900,
            belowThreshold: false,
          })),
        },
      },
    };

    const path = buildPathToHealthy(withKeywords, null, {
      avgCustomerValue: 350,
      mode: "revenue",
    });

    assert.ok(path);
    const rankStep = path!.steps.find((step) => step.id.startsWith("rank-outside-pack-"));
    assert.ok(rankStep, "expected a rank-outside-pack gap in the selected path");
    assert.ok((rankStep!.outcomeImpact ?? 0) > 0 || (rankStep!.revenueImpact ?? 0) > 0);
  });
});
