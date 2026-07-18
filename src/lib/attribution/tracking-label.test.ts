import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionAttribution } from "@/audit/types/timeseries";
import {
  attributionDaysRemaining,
  formatAttributionTrackingLabel,
  hasEarlyAttributionSignal,
} from "./tracking-label";

function stubAttribution(
  overrides: Partial<ActionAttribution> & Pick<ActionAttribution, "publishedAt">
): ActionAttribution {
  return {
    id: "attr-1",
    executionTaskId: "task-1",
    businessId: "biz-1",
    taskType: "review_response",
    actionItemId: "action-1",
    title: "Respond",
    windowDays: 7,
    primaryKeyword: null,
    rankBefore: null,
    rankAfter: null,
    rankDelta: null,
    keywordsImproved: 0,
    callsDelta: null,
    directionsDelta: null,
    websiteClicksDelta: null,
    impressionsDelta: null,
    estimatedRevenue: null,
    narrative: "",
    preliminary: true,
    computedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatAttributionTrackingLabel", () => {
  it("returns null when attribution is final", () => {
    const attribution = stubAttribution({
      publishedAt: "2026-06-01T00:00:00.000Z",
      preliminary: false,
    });
    assert.equal(formatAttributionTrackingLabel(attribution), null);
  });

  it("shows measuring state with days remaining", () => {
    const now = new Date("2026-07-03T12:00:00.000Z");
    const attribution = stubAttribution({
      publishedAt: "2026-07-01T00:00:00.000Z",
      windowDays: 7,
      preliminary: true,
    });
    assert.equal(
      formatAttributionTrackingLabel(attribution, now),
      "Measuring · 5 days left"
    );
  });

  it("shows early signal when engagement deltas appear during the window", () => {
    const now = new Date("2026-07-03T12:00:00.000Z");
    const attribution = stubAttribution({
      publishedAt: "2026-07-01T00:00:00.000Z",
      windowDays: 14,
      preliminary: true,
      callsDelta: 2,
    });
    assert.equal(
      formatAttributionTrackingLabel(attribution, now),
      "Early signal · 12 days left to confirm"
    );
    assert.equal(hasEarlyAttributionSignal(attribution), true);
  });

  it("computes days remaining from publish date and window", () => {
    const now = new Date("2026-07-15T00:00:00.000Z");
    const attribution = stubAttribution({
      publishedAt: "2026-07-01T00:00:00.000Z",
      windowDays: 14,
    });
    assert.equal(attributionDaysRemaining(attribution, now), 0);
  });
});
