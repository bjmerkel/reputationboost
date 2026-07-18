import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTemplateGbpPlan } from "./gbp-plan";
import { createTestAudit } from "../phase3/test-fixtures";

describe("buildTemplateGbpPlan copy", () => {
  it("avoids overstated ranking causality in step instructions", () => {
    const audit = createTestAudit();
    const plan = buildTemplateGbpPlan(audit);
    const allCopy = plan.steps.map((step) => `${step.instruction} ${step.recommended ?? ""}`).join("\n");

    assert.doesNotMatch(allCopy, /strongest ranking signal/i);
    assert.doesNotMatch(allCopy, /every target keyword/i);
    assert.doesNotMatch(allCopy, /strengthen rankings/i);
    assert.ok(plan.weeklyCadence.length > 0);
    assert.ok(plan.monthlyCadence.length > 0);
  });
});
