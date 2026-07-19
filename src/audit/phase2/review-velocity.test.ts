import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { buildPlan } from "@/audit/phase3/build-plan";
import { buildTemplateGbpPlan } from "./gbp-plan";
import { detectGaps } from "./gaps";
import {
  auditNeedsReviewVelocityBoost,
  isReviewVelocityGapId,
  keywordQualifiesForReviewVelocityGap,
  medianSearchKeywordImpressions,
} from "./review-velocity";
import { auditPrefersConversionOverRank } from "./conversion-boost";
import { buildKeywordActionBindings } from "./keyword-action-binding";
import { selectNextBestPlanSteps } from "../phase3/plan-next-actions";

describe("review-velocity gaps", () => {
  it("detects outside-pack review velocity gaps as P0 when pack share < 50%", () => {
    const audit = createTestAudit();
    audit.rankings.keywordsInPack = 1;
    audit.rankings.totalKeywords = 3;

    const gaps = detectGaps(audit).filter((gap) => isReviewVelocityGapId(gap.id));
    assert.ok(gaps.length >= 2);
    assert.ok(gaps.every((gap) => gap.priority === "P0"));
    assert.equal(auditNeedsReviewVelocityBoost(audit), true);
    assert.equal(auditPrefersConversionOverRank(audit), false);
  });

  it("uses impression median when search keyword data exists", () => {
    const audit = createTestAudit();
    const kw = audit.rankings.keywords[0]!;
    audit.gbp.performance.searchKeywords = [
      { keyword: kw.keyword, impressions: 1200, belowThreshold: false },
      { keyword: "low volume term", impressions: 100, belowThreshold: false },
    ];
    const median = medianSearchKeywordImpressions(audit.gbp.performance.searchKeywords);
    assert.equal(median, 650);
    assert.equal(
      keywordQualifiesForReviewVelocityGap(kw, audit.gbp.performance.searchKeywords),
      true
    );
  });

  it("binds outside-pack review velocity keywords to step 10 first", () => {
    const audit = createTestAudit();
    audit.rankings.keywordsInPack = 1;
    audit.rankings.totalKeywords = 3;
    const bindings = buildKeywordActionBindings(audit);
    const outside = bindings.filter((binding) => !binding.inLocalPack);
    assert.ok(outside.length > 0);
    assert.ok(outside.some((binding) => binding.primaryStep === 10));
  });

  it("elevates step 10 into NBA top 3 for outside-pack review velocity", () => {
    const audit = createTestAudit();
    audit.rankings.keywordsInPack = 1;
    audit.rankings.totalKeywords = 3;
    const gbpPlan = buildTemplateGbpPlan(audit, { avgCustomerValue: 350 });
    audit.strategy.gbpPlan = gbpPlan;
    const plan = buildPlan(audit, audit.execution?.tasks ?? [], [], undefined, 350);
    assert.ok(plan);

    const nba = selectNextBestPlanSteps(plan!, 3, { reviewVelocityBoost: true });
    assert.ok(nba.some((step) => step.stepNumber === 10));
  });

  it("does not apply review velocity boost when mostly in-pack", () => {
    const audit = createTestAudit();
    audit.rankings.keywordsInPack = 3;
    audit.rankings.totalKeywords = 3;
    audit.rankings.keywords = audit.rankings.keywords.map((kw) => ({
      ...kw,
      inLocalPack: true,
      localPackPosition: 2,
    }));
    assert.equal(auditNeedsReviewVelocityBoost(audit), false);
  });
});
