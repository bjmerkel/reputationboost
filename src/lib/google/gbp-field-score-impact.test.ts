import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enrichLocationInventoryScores,
  estimateFieldRevenueImpact,
  scoreImpactForField,
} from "./gbp-field-score-impact";
import type { GbpLocationInventory } from "@/audit/types";

const sampleInventory: GbpLocationInventory = {
  collectedAt: "2026-07-06T12:00:00.000Z",
  source: "oauth",
  fields: [
    {
      apiPath: "profile.description",
      label: "Business description",
      section: "profile",
      current: "Short",
      status: "needs_work",
      editable: true,
    },
    {
      apiPath: "regularHours",
      label: "Regular hours",
      section: "hours",
      current: "None",
      status: "missing",
      editable: true,
    },
    {
      apiPath: "engagement.reviews",
      label: "Reviews",
      section: "engagement",
      current: "45 reviews",
      status: "good",
      editable: true,
    },
  ],
  summary: {
    total: 3,
    good: 1,
    needsWork: 1,
    missing: 1,
    conflict: 0,
    processing: 0,
    blocked: 0,
  },
};

describe("gbp-field-score-impact", () => {
  it("assigns higher impact to missing fields than needs_work", () => {
    const missing = scoreImpactForField("profile.description", "missing");
    const needsWork = scoreImpactForField("profile.description", "needs_work");
    assert.ok(missing.scoreImpact > needsWork.scoreImpact);
    assert.equal(needsWork.scoreComponent, "conversion");
  });

  it("returns zero impact for good fields", () => {
    const good = scoreImpactForField("engagement.reviews", "good");
    assert.equal(good.scoreImpact, 0);
  });

  it("enriches inventory with score impacts and sorts by impact", () => {
    const enriched = enrichLocationInventoryScores(sampleInventory, {
      monthlyActions: 50,
      avgCustomerValue: 500,
    });

    assert.ok((enriched.summary.potentialScoreGain ?? 0) > 0);
    assert.ok((enriched.fields[0].scoreImpact ?? 0) >= (enriched.fields[1].scoreImpact ?? 0));
    assert.ok(enriched.fields.some((f) => f.revenueImpact != null));
  });

  it("estimates revenue when customer value is provided", () => {
    const revenue = estimateFieldRevenueImpact(4, {
      monthlyActions: 40,
      avgCustomerValue: 600,
    });
    assert.ok(revenue != null && revenue > 0);
  });
});
