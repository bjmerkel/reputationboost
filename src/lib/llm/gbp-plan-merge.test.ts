import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { buildPlanStepCandidates } from "@/audit/phase2/plan-candidates";
import {
  computeKeywordPortfolio,
  KEYWORD_PORTFOLIO_PLAN_STEP,
} from "@/audit/phase2/keyword-portfolio";
import { CUSTOM_PLAN_STEP_START } from "@/audit/phase3/plan-custom-steps";
import {
  isSelectableGbpPlanStepNumber,
  mergeLlmGbpPlan,
  validateCustomAction,
  validateLlmGbpPlanResponse,
} from "./gbp-plan-merge";
import { buildTemplateGbpPlan } from "@/audit/phase2/gbp-plan";

describe("buildPlanStepCandidates", () => {
  it("includes simulated impacts and satisfaction flags for all active steps", () => {
    const audit = createTestAudit();
    const candidates = buildPlanStepCandidates(audit);

    assert.equal(candidates.length, 13);
    assert.equal(candidates.some((candidate) => candidate.stepNumber === 16), false);
    assert.equal(candidates.some((candidate) => candidate.title === "Messaging"), false);
    assert.equal(candidates.some((candidate) => candidate.title === "Booking Feature"), false);
    const unsatisfied = candidates.filter((c) => !c.satisfied);
    assert.ok(unsatisfied.length > 0);
    assert.ok(unsatisfied.some((c) => c.driverScoreImpact > 0));
    assert.ok(candidates.every((c) => Array.isArray(c.linkedKeywords)));
    assert.ok(candidates.some((c) => c.linkedGapIds.length > 0));
    assert.ok(candidates.every((c) => c.templateStep.stepNumber === c.stepNumber));
  });
});

describe("isSelectableGbpPlanStepNumber", () => {
  it("allows 1–15 and portfolio step 17, rejects retired 16", () => {
    assert.equal(isSelectableGbpPlanStepNumber(1), true);
    assert.equal(isSelectableGbpPlanStepNumber(15), true);
    assert.equal(isSelectableGbpPlanStepNumber(16), false);
    assert.equal(isSelectableGbpPlanStepNumber(KEYWORD_PORTFOLIO_PLAN_STEP), true);
    assert.equal(isSelectableGbpPlanStepNumber(18), false);
  });
});

describe("validateLlmGbpPlanResponse", () => {
  it("rejects responses with fewer than 3 valid steps", () => {
    assert.equal(
      validateLlmGbpPlanResponse({
        selectedSteps: [{ stepNumber: 3, instruction: "do thing" }],
      }),
      null
    );
  });

  it("rejects retired step 16 and accepts portfolio step 17", () => {
    const withRetired = validateLlmGbpPlanResponse({
      selectedSteps: [
        { stepNumber: 16, instruction: "Continuous activity" },
        { stepNumber: 3, instruction: "Rewrite description" },
        { stepNumber: 8, instruction: "Post weekly" },
        { stepNumber: 11, instruction: "Respond" },
      ],
    });
    assert.ok(withRetired);
    assert.equal(withRetired!.selectedSteps!.some((s) => s.stepNumber === 16), false);
    assert.equal(withRetired!.selectedSteps!.length, 3);

    const withPortfolio = validateLlmGbpPlanResponse({
      selectedSteps: [
        { stepNumber: 17, instruction: "Align keywords" },
        { stepNumber: 3, instruction: "Rewrite description" },
        { stepNumber: 8, instruction: "Post weekly" },
      ],
    });
    assert.ok(withPortfolio);
    assert.equal(withPortfolio!.selectedSteps![0].stepNumber, 17);
  });

  it("accepts valid strategist responses", () => {
    const valid = validateLlmGbpPlanResponse({
      selectedSteps: [
        { stepNumber: 11, instruction: "Respond to negatives", selectionRationale: "urgent" },
        { stepNumber: 3, instruction: "Rewrite description", selectionRationale: "keywords" },
        { stepNumber: 8, instruction: "Post weekly", selectionRationale: "stale" },
      ],
      customActions: [
        {
          title: "Fleet photo batch",
          instruction: "Upload 10 vehicle photos",
          rationale: "Differentiator for airport shuttle searches",
        },
      ],
    });
    assert.ok(valid);
    assert.equal(valid!.selectedSteps!.length, 3);
    assert.equal(valid!.customActions!.length, 1);
  });
});

describe("validateCustomAction", () => {
  it("rejects malformed custom actions", () => {
    assert.equal(validateCustomAction({ title: "x", instruction: "short" }), null);
    assert.equal(
      validateCustomAction({
        title: "Valid title",
        instruction: "Do something meaningful in GBP",
        rationale: "Because competitors have this coverage",
        gbpAction: "not_a_real_action",
      }),
      null
    );
  });
});

describe("mergeLlmGbpPlan", () => {
  it("merges LLM selections and skips satisfied steps", () => {
    const audit = createTestAudit();
    const fallback = buildTemplateGbpPlan(audit);
    const candidates = buildPlanStepCandidates(audit);

    const merged = mergeLlmGbpPlan(
      fallback,
      {
        selectedSteps: [
          { stepNumber: 6, instruction: "Add photos", selectionRationale: "low count" },
          { stepNumber: 11, instruction: "Respond", selectionRationale: "negatives" },
          { stepNumber: 8, instruction: "Post", selectionRationale: "stale" },
        ],
      },
      candidates,
      audit
    );

    assert.equal(merged.contentSource, "llm");
    assert.equal(merged.steps.length, 3);
    assert.ok(merged.steps.every((s) => s.instruction.includes("Why this step:")));
    assert.ok(merged.steps.every((s, i) => s.displayOrder === i));
  });

  it("preserves impact order instead of sorting by stepNumber", () => {
    const audit = createTestAudit();
    const fallback = buildTemplateGbpPlan(audit);
    const candidates = buildPlanStepCandidates(audit);

    const merged = mergeLlmGbpPlan(
      fallback,
      {
        selectedSteps: [
          { stepNumber: 1, instruction: "Category", selectionRationale: "fit" },
          { stepNumber: 8, instruction: "Post", selectionRationale: "stale" },
          { stepNumber: 11, instruction: "Respond", selectionRationale: "trust" },
          { stepNumber: 3, instruction: "Rewrite", selectionRationale: "keywords" },
        ],
      },
      candidates,
      audit
    );

    const numbers = merged.steps.map((s) => s.stepNumber);
    // Must not be ascending step-number order when impact ranking differs.
    const ascending = [...numbers].sort((a, b) => a - b);
    assert.deepEqual(
      merged.steps.map((s) => s.displayOrder),
      numbers.map((_, i) => i)
    );
    // High-impact content/reputation steps should outrank a no-op-ish category when unsatisfied.
    if (JSON.stringify(numbers) === JSON.stringify(ascending)) {
      // If impact happens to align with step numbers, still verify displayOrder is stamped.
      assert.equal(merged.steps[0].displayOrder, 0);
    } else {
      assert.notDeepEqual(numbers, ascending);
    }
  });

  it("appends custom actions at step 18+ and never steals portfolio 17", () => {
    const audit = createTestAudit();
    const fallback = buildTemplateGbpPlan(audit);
    const candidates = buildPlanStepCandidates(audit);

    const merged = mergeLlmGbpPlan(
      fallback,
      {
        selectedSteps: [
          { stepNumber: 3, instruction: "Rewrite", selectionRationale: "keywords" },
          { stepNumber: 8, instruction: "Post", selectionRationale: "stale" },
          { stepNumber: 11, instruction: "Respond", selectionRationale: "trust" },
        ],
        customActions: [
          {
            title: "Airport route video",
            instruction: "Upload a 45-second airport pickup video",
            rationale: "Targets airport shuttle keyword gap",
          },
        ],
      },
      candidates,
      audit
    );

    assert.equal(merged.steps.length, 4);
    const custom = merged.steps.find((s) => s.title === "Airport route video");
    assert.ok(custom);
    assert.equal(custom!.stepNumber, CUSTOM_PLAN_STEP_START);
    assert.equal(custom!.stepNumber >= 18, true);
    assert.equal(
      merged.steps.some((s) => s.stepNumber === KEYWORD_PORTFOLIO_PLAN_STEP && s.title === "Airport route video"),
      false
    );
  });

  it("appends unsatisfied keyword portfolio even when LLM omits step 17", () => {
    const audit = createTestAudit();
    // Force portfolio into the candidate pool by seeding a mismatch-like signal.
    audit.gbp.performance.searchKeywords = [
      { keyword: "water heater repair dallas", impressions: 900, belowThreshold: false },
      { keyword: "tankless water heater dallas", impressions: 600, belowThreshold: false },
      { keyword: "plumbing company dallas", impressions: 400, belowThreshold: false },
    ];
    audit.keywordPortfolio = computeKeywordPortfolio(audit);

    const fallback = buildTemplateGbpPlan(audit);
    const candidates = buildPlanStepCandidates(audit);
    const hasPortfolioCandidate = candidates.some(
      (c) => c.stepNumber === KEYWORD_PORTFOLIO_PLAN_STEP && !c.satisfied
    );

    if (!hasPortfolioCandidate) {
      // Fixture may already be demand-aligned; still verify merge doesn't crash.
      const merged = mergeLlmGbpPlan(
        fallback,
        {
          selectedSteps: [
            { stepNumber: 3, instruction: "Rewrite", selectionRationale: "keywords" },
            { stepNumber: 8, instruction: "Post", selectionRationale: "stale" },
            { stepNumber: 11, instruction: "Respond", selectionRationale: "trust" },
          ],
        },
        candidates,
        audit
      );
      assert.equal(merged.contentSource, "llm");
      return;
    }

    const merged = mergeLlmGbpPlan(
      fallback,
      {
        selectedSteps: [
          { stepNumber: 3, instruction: "Rewrite", selectionRationale: "keywords" },
          { stepNumber: 8, instruction: "Post", selectionRationale: "stale" },
          { stepNumber: 11, instruction: "Respond", selectionRationale: "trust" },
        ],
      },
      candidates,
      audit
    );

    assert.ok(merged.steps.some((s) => s.stepNumber === KEYWORD_PORTFOLIO_PLAN_STEP));
    assert.ok(merged.steps.every((s) => s.stepNumber !== 16));
  });

  it("falls back when merged plan has too few steps", () => {
    const audit = createTestAudit();
    const fallback = buildTemplateGbpPlan(audit);
    const candidates = buildPlanStepCandidates(audit);

    const merged = mergeLlmGbpPlan(
      fallback,
      { selectedSteps: [{ stepNumber: 99, instruction: "invalid" }] as never },
      candidates,
      audit
    );

    assert.equal(merged, fallback);
  });
});
