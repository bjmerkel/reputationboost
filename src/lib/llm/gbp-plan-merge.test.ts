import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { buildPlanStepCandidates } from "@/audit/phase2/plan-candidates";
import {
  mergeLlmGbpPlan,
  validateCustomAction,
  validateLlmGbpPlanResponse,
} from "./gbp-plan-merge";
import { buildTemplateGbpPlan } from "@/audit/phase2/gbp-plan";

describe("buildPlanStepCandidates", () => {
  it("includes simulated impacts and satisfaction flags for all 15 steps", () => {
    const audit = createTestAudit();
    const candidates = buildPlanStepCandidates(audit);

    assert.equal(candidates.length, 15);
    const unsatisfied = candidates.filter((c) => !c.satisfied);
    assert.ok(unsatisfied.length > 0);
    assert.ok(unsatisfied.some((c) => c.driverScoreImpact > 0));
    assert.ok(candidates.every((c) => Array.isArray(c.linkedKeywords)));
    assert.ok(candidates.some((c) => c.linkedGapIds.length > 0));
    assert.ok(candidates.every((c) => c.templateStep.stepNumber === c.stepNumber));
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
  });

  it("appends custom actions with step numbers 17+", () => {
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
    assert.equal(merged.steps[3].stepNumber, 17);
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
