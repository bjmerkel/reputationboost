import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  projectOutcomeScoresFromActions,
  stackDampeningFactor,
} from "../phase2/counterfactual";
import {
  CONVERSION_PLAN_STEPS,
  resolveForcedPlanStepNumbers,
  buildPlanStepCandidates,
} from "../phase2/plan-candidates";
import {
  estimateStepEngagementImpact,
  estimateStepLeadsImpact,
  estimateStepOutcomeImpact,
  estimateStepRevenueImpact,
} from "../phase2/score-impact";
import { buildPlan } from "./build-plan";
import { formatPlanStepImpactLabel } from "./plan-impact-label";
import {
  PLAN_DEFINITION_OF_NINE,
  PLAN_SOAK_CHECKLIST,
} from "./plan-proof-pack";
import { refreshGbpPlanForReconcile } from "./reconcile-plan";
import { createTestAudit } from "./test-fixtures";
import {
  PLAN_CHANGELOG_SECTION_ID,
  resolveResultsFocus,
} from "@/components/results/results-focus";

function conversionAudit() {
  const audit = createTestAudit();
  audit.gbp.performance.profileViews = 500;
  audit.gbp.performance.calls = 0;
  audit.gbp.performance.directionRequests = 0;
  audit.gbp.performance.websiteClicks = 0;
  audit.gbp.performance.searchKeywords = [
    { keyword: "emergency plumber dallas", impressions: 1200, belowThreshold: false },
    { keyword: "drain cleaning dallas", impressions: 800, belowThreshold: false },
    { keyword: "plumber near me", impressions: 600, belowThreshold: false },
  ];
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
  return audit;
}

describe("Plan proof pack (Definition of 9)", () => {
  it("documents six acceptance criteria and a live soak checklist", () => {
    assert.equal(PLAN_DEFINITION_OF_NINE.length, 6);
    assert.ok(PLAN_SOAK_CHECKLIST.length >= 5);
    assert.deepEqual(
      PLAN_DEFINITION_OF_NINE.map((item) => item.id),
      ["J1", "J2", "J3", "J4", "J5", "J6"]
    );
  });

  describe("J1 — selective reconcile", () => {
    it("keeps curated plans from re-bloating into the full checklist", () => {
      const audit = createTestAudit();
      audit.strategy.gbpPlan = {
        ...audit.strategy.gbpPlan!,
        steps: audit.strategy.gbpPlan!.steps.filter((step) =>
          [8, 11, 3].includes(step.stepNumber)
        ),
      };
      const curatedCount = audit.strategy.gbpPlan!.steps.length;
      assert.equal(curatedCount, 3);

      const { plan, appendedStepNumbers } = refreshGbpPlanForReconcile(audit, {
        avgCustomerValue: 350,
      });
      assert.ok(plan);

      // Must not append unsatisfied non-forced checklist steps.
      for (const stepNumber of [5, 6, 7, 12]) {
        assert.equal(
          appendedStepNumbers.includes(stepNumber),
          false,
          `step ${stepNumber} must not be force-appended`
        );
      }

      assert.ok(plan.steps.length < 10, "curated plan must stay far below full checklist");
      assert.ok(plan.steps.length <= curatedCount + appendedStepNumbers.length);

      const forced = resolveForcedPlanStepNumbers(
        audit,
        buildPlanStepCandidates(audit, { avgCustomerValue: 350 })
      );
      for (const stepNumber of appendedStepNumbers) {
        assert.ok(
          forced.includes(stepNumber) || [3, 8, 11].includes(stepNumber),
          `appended ${stepNumber} should be forced or already curated`
        );
      }
    });
  });

  describe("J2 — mixed-stack dampening", () => {
    it("dampens mixed rank+conversion revenue below the isolated sum", () => {
      const audit = conversionAudit();
      const options = { avgCustomerValue: 350 };

      const rankStep = projectOutcomeScoresFromActions(
        audit,
        [{ source: "plan", id: "gbp-step-3" }],
        options
      );
      const conversionStep = projectOutcomeScoresFromActions(
        audit,
        [{ source: "plan", id: "gbp-step-8" }],
        options
      );
      const mixed = projectOutcomeScoresFromActions(
        audit,
        [
          { source: "plan", id: "gbp-step-3" },
          { source: "plan", id: "gbp-step-8" },
        ],
        options
      );

      const isolatedSum =
        (rankStep.revenueGain ?? 0) + (conversionStep.revenueGain ?? 0);
      assert.ok(isolatedSum > 0);
      assert.ok(
        (mixed.revenueGain ?? 0) < isolatedSum,
        `mixed ${mixed.revenueGain} must be < isolated ${isolatedSum}`
      );

      const dampenedCeiling =
        (rankStep.revenueGain ?? 0) +
        Math.round((conversionStep.revenueGain ?? 0) * stackDampeningFactor(1));
      assert.ok(
        (mixed.revenueGain ?? 0) <= dampenedCeiling + 1,
        `mixed ${mixed.revenueGain} must respect stack dampening (≤ ${dampenedCeiling + 1})`
      );
    });
  });

  describe("J3 — first-class leads", () => {
    it("exposes leads without ACV, including small conversion gains", () => {
      const audit = conversionAudit();
      const plan = buildPlan(audit, audit.execution!.tasks);
      assert.ok(plan);

      const step8 = plan.steps.find((step) => step.stepNumber === 8);
      assert.ok(step8);
      assert.equal(step8.context.revenueImpact ?? null, null);
      assert.ok((step8.context.leadsImpact ?? 0) > 0);
      assert.match(formatPlanStepImpactLabel(step8, "USD") ?? "", /leads\/mo/);

      // Step 13 website-click lift used to vanish under unit-ACV rounding.
      const leads13 = estimateStepLeadsImpact(audit, 13);
      assert.ok(leads13 != null && leads13 > 0, "step 13 fractional leads must remain visible");

      const withAcv = estimateStepRevenueImpact(audit, 8, 350);
      assert.ok(withAcv != null && withAcv > 0, "ACV unlocks $/mo for conversion steps");
    });
  });

  describe("J4 — conversion engagement signal", () => {
    it("keeps pack-rank outcome at 0 while engagement signal is > 0", () => {
      const audit = conversionAudit();

      for (const stepNumber of CONVERSION_PLAN_STEPS) {
        assert.equal(
          estimateStepOutcomeImpact(audit, stepNumber),
          0,
          `step ${stepNumber} must not claim pack-rank outcome pts`
        );
        const engagement = estimateStepEngagementImpact(audit, stepNumber);
        assert.ok(
          (engagement ?? 0) > 0,
          `step ${stepNumber} engagement actions must be > 0`
        );

        const projected = projectOutcomeScoresFromActions(audit, [
          { source: "plan", id: `gbp-step-${stepNumber}` },
        ]);
        assert.equal(projected.outcomeGain, 0);
        assert.ok((projected.engagementActionsGain ?? 0) > 0);
        assert.ok((projected.leadsGain ?? 0) > 0);
      }
    });
  });

  describe("J5 — deep-link focus clear", () => {
    it("resolves missing results-step anchors to changelog miss (focus can clear)", () => {
      const hit = resolveResultsFocus(8, (id) => id === "results-step-8");
      assert.equal(hit.kind, "hit");

      const miss = resolveResultsFocus(8, () => false);
      assert.equal(miss.kind, "miss");
      if (miss.kind === "miss") {
        assert.equal(miss.sectionId, PLAN_CHANGELOG_SECTION_ID);
        assert.equal(miss.stepNumber, 8);
      }
    });
  });
});
