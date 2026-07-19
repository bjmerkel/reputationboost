import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  buildAcvRevenuePreview,
  defaultAcvPreviewHint,
  resolveGoogleUpdatesPresentation,
} from "./plan-viewport";

describe("resolveGoogleUpdatesPresentation", () => {
  it("returns hidden when there are no Google update fields", () => {
    const audit = createTestAudit();
    const presentation = resolveGoogleUpdatesPresentation(audit, []);
    assert.equal(presentation.mode, "hidden");
  });

  it("returns compact when only processing fields are pending", () => {
    const audit = createTestAudit();
    audit.gbp.googleSuggestions = [
      {
        field: "description",
        label: "Description",
        ownerValue: "Our description",
        googleValue: "Our description",
        kind: "pending",
      },
    ];
    const presentation = resolveGoogleUpdatesPresentation(audit, []);
    assert.equal(presentation.mode, "compact");
    assert.equal(presentation.pendingCount, 1);
  });

  it("returns full when Google diffs need a decision", () => {
    const audit = createTestAudit();
    audit.gbp.googleSuggestions = [
      {
        field: "phone",
        label: "Phone",
        ownerValue: "(214) 555-0100",
        googleValue: "(214) 555-0199",
        kind: "diff",
      },
    ];
    const presentation = resolveGoogleUpdatesPresentation(audit, []);
    assert.equal(presentation.mode, "full");
    assert.equal(presentation.diffCount, 1);
  });
});

describe("buildAcvRevenuePreview", () => {
  it("estimates example revenue from projected leads and category ACV", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Plumber";
    const preview = buildAcvRevenuePreview(audit, {
      nextThreeProjectedMonthlyLeads: 4,
      nextThreeEstimatedMonthlyLeads: 2,
    });
    assert.ok(preview);
    assert.equal(preview!.defaultAcv, 350);
    assert.equal(preview!.projectedMonthlyRevenue, 1400);
    assert.equal(preview!.leadGain, 2);
  });

  it("uses retail-default ACV for low-ticket categories", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Retail store";
    assert.equal(defaultAcvPreviewHint(audit), 75);
  });

  it("prefers an LLM/template estimated ACV when provided", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Plumber";
    const preview = buildAcvRevenuePreview(audit, {
      nextThreeProjectedMonthlyLeads: 3,
      estimatedAcv: 425,
    });
    assert.ok(preview);
    assert.equal(preview!.defaultAcv, 425);
    assert.equal(preview!.projectedMonthlyRevenue, 1275);
  });
});
