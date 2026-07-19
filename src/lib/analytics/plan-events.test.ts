import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { logPlanEvent, type PlanAnalyticsEvent } from "./plan-events";

describe("plan-events", () => {
  it("logPlanEvent emits structured JSON with type plan_analytics", () => {
    const lines: string[] = [];
    const original = console.info;
    console.info = (message: string) => {
      lines.push(message);
    };

    try {
      const event: PlanAnalyticsEvent = {
        name: "plan_nba_click",
        stepNumber: 15,
        businessId: "biz-1",
      };
      logPlanEvent(event);
      assert.equal(lines.length, 1);
      const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
      assert.equal(parsed.type, "plan_analytics");
      assert.equal(parsed.name, "plan_nba_click");
      assert.equal(parsed.stepNumber, 15);
      assert.equal(parsed.businessId, "biz-1");
      assert.ok(typeof parsed.occurredAt === "string");
    } finally {
      console.info = original;
    }
  });
});
