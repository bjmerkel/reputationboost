import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  auditNeedsConversionBoost,
  buildPlanStepCandidates,
  profileNeedsConversionWork,
  RANK_OUTSIDE_PACK_PLAN_STEPS,
  resolveForcedPlanStepNumbers,
} from "./plan-candidates";
import { estimateStepRevenueImpact } from "./score-impact";

describe("plan-candidates conversion gaps", () => {
  it("links views-without-actions to CTA, replies, attributes, and place actions", () => {
    const audit = createTestAudit();
    audit.gbp.performance.profileViews = 400;
    audit.gbp.performance.calls = 0;
    audit.gbp.performance.directionRequests = 0;
    audit.gbp.performance.websiteClicks = 0;
    audit.gbp.performance.coverage = {
      apiAvailable: true,
      partialApi: false,
      coverageScore: 70,
      hasCoreMetrics: true,
      hasImpressionMetrics: true,
      hasSearchKeywords: false,
      hasConversations: false,
      hasBookings: false,
      keywordCount: 0,
      trackedKeywordCount: 0,
      totalActions: 0,
      actionRate: 0,
      endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "skipped" },
      recommendations: [],
    };
    audit.gbp.placeActions = {
      apiAvailable: true,
      partialApi: false,
      coverageScore: 0,
      linkCount: 0,
      merchantLinkCount: 0,
      configuredTypes: [],
      availableTypes: ["APPOINTMENT"],
      missingRecommendedTypes: ["APPOINTMENT"],
      missingAvailableTypes: ["APPOINTMENT"],
      typeCatalog: [{ placeActionType: "APPOINTMENT", displayName: "Book" }],
      hasAppointmentLink: false,
      hasOnlineAppointmentLink: false,
      hasDiningReservationLink: false,
      hasFoodOrderingLink: false,
      hasShopOnlineLink: false,
      endpoints: { links: "ok", typeMetadata: "ok" },
      recommendations: [],
    };

    assert.equal(auditNeedsConversionBoost(audit), true);
    assert.equal(profileNeedsConversionWork(audit), true);

    const candidates = buildPlanStepCandidates(audit, { avgCustomerValue: 350 });
    const byStep = new Map(candidates.map((c) => [c.stepNumber, c]));

    assert.ok(byStep.get(15), "place actions step present when unsatisfied");
    assert.ok(byStep.get(15)!.linkedGapIds.includes("low-profile-conversions"));
    assert.ok(byStep.get(15)!.linkedGapIds.includes("missing-place-action-links"));
    assert.ok(byStep.get(8)!.linkedGapIds.includes("low-profile-conversions"));

    const placeActionRevenue = estimateStepRevenueImpact(audit, 15, 350);
    assert.ok(placeActionRevenue != null && placeActionRevenue > 0);
  });

  it("links rank-outside-pack gaps to description, services, posts, and reviews", () => {
    const audit = createTestAudit();
    const candidates = buildPlanStepCandidates(audit);
    const byStep = new Map(candidates.map((c) => [c.stepNumber, c]));

    for (const stepNumber of RANK_OUTSIDE_PACK_PLAN_STEPS) {
      const linked = byStep.get(stepNumber)?.linkedGapIds ?? [];
      assert.ok(
        linked.some((id) => id.startsWith("rank-outside-pack")),
        `step ${stepNumber} should link rank-outside-pack gaps`
      );
    }
  });

  it("forces only merge-class steps, not the full unsatisfied checklist", () => {
    const audit = createTestAudit();
    const candidates = buildPlanStepCandidates(audit);
    const forced = resolveForcedPlanStepNumbers(audit, candidates);

    for (const stepNumber of RANK_OUTSIDE_PACK_PLAN_STEPS) {
      assert.ok(forced.includes(stepNumber), `expected forced rank step ${stepNumber}`);
    }
    // Photos / hours / videos are unsatisfied in the fixture but not merge-forced.
    assert.equal(forced.includes(6), false);
    assert.equal(forced.includes(7), false);
    assert.equal(forced.includes(12), false);
  });
});
