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
  auditNeedsConversionBoost,
  auditPrefersConversionOverRank,
} from "../phase2/conversion-boost";
import {
  buildKeywordActionBindings,
  buildKeywordPlaybooks,
  resolveBestPlanStepForKeyword,
  resolveStepPrimaryKeyword,
} from "../phase2/keyword-action-binding";
import {
  isStepSatisfied,
  keywordsTargetedByStep,
  photoCoverageIsHealthy,
} from "../phase2/counterfactual";
import { planStepImpactScore } from "../phase2/gbp-plan";
import {
  blendEngagementRates,
  buildAttributionCalibration,
} from "../phase2/attribution-calibration";
import {
  estimateStepEngagementImpact,
  estimateStepLeadsImpact,
  estimateStepOutcomeImpact,
  estimateStepRevenueImpact,
} from "../phase2/score-impact";
import { buildPlan } from "./build-plan";
import {
  formatCustomPlanStepSignal,
  formatPlanStepImpactLabel,
} from "./plan-impact-label";
import { selectNextBestPlanSteps } from "./plan-next-actions";
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
import { sortPendingTasks } from "@/lib/execution/pending-tasks";
import type { ExecutionTask } from "../types";
import type { ActionAttribution } from "../types/timeseries";

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
  it("documents polish + revenue acceptance criteria and a live soak checklist", () => {
    assert.equal(PLAN_DEFINITION_OF_NINE.length, 12);
    assert.ok(PLAN_SOAK_CHECKLIST.length >= 12);
    assert.deepEqual(
      PLAN_DEFINITION_OF_NINE.map((item) => item.id),
      ["J1", "J2", "J3", "J4", "J5", "J6", "R1", "R2", "R3", "R4", "R5", "R6"]
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

  describe("R1 — keyword action binding", () => {
    it("keeps primaryKeyword inside keywordsTargetedByStep and deep-links bound steps", () => {
      const audit = createTestAudit();
      const plan = buildPlan(audit, audit.execution!.tasks);
      assert.ok(plan);

      for (const step of plan.steps.filter((s) => [3, 4, 5, 8].includes(s.stepNumber))) {
        const targeted = keywordsTargetedByStep(audit, step.stepNumber);
        const primary =
          step.context.primaryKeyword ?? resolveStepPrimaryKeyword(audit, step.stepNumber);
        assert.ok(primary, `step ${step.stepNumber} needs a primary keyword`);
        assert.ok(
          targeted.some((kw) => kw.toLowerCase() === primary!.toLowerCase()),
          `step ${step.stepNumber} primary must be targeted`
        );
      }

      const bindings = buildKeywordActionBindings(audit);
      const outside = bindings.filter((b) => !b.inLocalPack);
      assert.ok(outside.length >= 2);
      for (const binding of outside) {
        const linked = resolveBestPlanStepForKeyword(audit, plan, binding.keyword);
        assert.ok(linked != null, `expected deep-link for ${binding.keyword}`);
        const card = plan.steps.find((s) => s.stepNumber === linked);
        assert.ok(card);
        assert.ok(
          card.status === "pending" ||
            card.status === "needs_approval" ||
            card.status === "approved"
        );
      }
    });
  });

  describe("R2 — weak conversion rate", () => {
    it("boosts conversion work for weak action rates and overweights NBA when in-pack", () => {
      const audit = createTestAudit();
      audit.rankings.keywordsInPack = 3;
      audit.rankings.totalKeywords = 3;
      audit.rankings.keywords = audit.rankings.keywords.map((kw) => ({
        ...kw,
        inLocalPack: true,
        localPackPosition: 2 as const,
        geoRanks: kw.geoRanks.map((g) => ({ ...g, rank: 2, inLocalPack: true })),
      }));
      audit.gbp.performance.profileViews = 500;
      audit.gbp.performance.calls = 3;
      audit.gbp.performance.directionRequests = 2;
      audit.gbp.performance.websiteClicks = 0;
      audit.gbp.performance.coverage = {
        apiAvailable: true,
        partialApi: false,
        coverageScore: 70,
        hasCoreMetrics: true,
        hasImpressionMetrics: true,
        hasSearchKeywords: true,
        hasConversations: false,
        hasBookings: false,
        keywordCount: 3,
        trackedKeywordCount: 3,
        totalActions: 5,
        actionRate: 1,
        endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "ok" },
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
      assert.equal(auditPrefersConversionOverRank(audit), true);

      const plan = buildPlan(audit, audit.execution?.tasks ?? []);
      assert.ok(plan);
      // Ensure conversion + photo steps exist for NBA ordering assertion.
      const ensure = (stepNumber: number, title: string, revenue: number) => {
        if (plan.steps.some((s) => s.stepNumber === stepNumber)) return;
        plan.steps.push({
          stepNumber,
          title,
          phaseId: "foundation",
          instruction: title,
          status: "needs_approval",
          tasks: [],
          displayOrder: stepNumber,
          context: {
            targetKeywords: ["plumber near me"],
            primaryKeyword: "plumber near me",
            expectedEffect: title,
            revenueImpact: revenue,
            leadsImpact: 1,
            engagementImpact: stepNumber === 6 ? 0 : 12,
            outcomeScoreImpact: stepNumber === 6 ? 2 : 0,
            healthScoreImpact: 2,
          },
        });
      };
      ensure(6, "Photos", 250);
      ensure(15, "Place action links", 90);
      ensure(8, "Weekly Google Posts", 70);

      const nba = selectNextBestPlanSteps(plan, 2, { preferConversionSteps: true });
      assert.ok(nba.length >= 1);
      assert.ok(
        [8, 11, 13, 15].includes(nba[0]!.stepNumber),
        `NBA should lead with a conversion step, got ${nba[0]?.stepNumber}`
      );
      assert.notEqual(nba[0]?.stepNumber, 6);
    });
  });

  describe("R3 — calibrated engagement estimates", () => {
    it("blends observed attribution into conversion rates and labels model vs calibrated", () => {
      const audit = conversionAudit();
      const heuristic = { calls: 0.025, directions: 0.04, websiteClicks: 0.03 };
      const attributions: ActionAttribution[] = [1, 2, 3, 4, 5].map((i) => ({
        id: `a${i}`,
        executionTaskId: `t${i}`,
        businessId: "b1",
        taskType: "gbp_place_action",
        actionItemId: "gbp-step-15",
        title: "Place actions",
        publishedAt: "2026-06-01T00:00:00.000Z",
        windowDays: 14,
        primaryKeyword: "plumber near me",
        rankBefore: null,
        rankAfter: null,
        rankDelta: null,
        keywordsImproved: 0,
        callsDelta: 2,
        directionsDelta: 3,
        websiteClicksDelta: 1,
        impressionsDelta: null,
        estimatedRevenue: 200,
        narrative: "",
        preliminary: false,
        computedAt: "2026-06-15T00:00:00.000Z",
        projectedRevenueGain: 400,
      }));
      const calibration = buildAttributionCalibration(attributions);
      assert.ok(calibration[15].sampleSize >= 5);

      const blended = blendEngagementRates(
        heuristic,
        15,
        500,
        calibration
      );
      // Observed monthlyized rates are lower than heuristics → blend should pull down.
      assert.ok(blended.calls < heuristic.calls);
      assert.ok(blended.calls >= heuristic.calls * 0.5);

      const uncalibrated = formatPlanStepImpactLabel({
        stepNumber: 15,
        phaseId: "conversion",
        title: "Place actions",
        instruction: "Add links",
        context: {
          targetKeywords: [],
          expectedEffect: "More calls",
          revenueImpact: 100,
          projectionConfidence: "default",
        },
        tasks: [],
        status: "pending",
      });
      assert.match(uncalibrated ?? "", /model est/);

      const calibratedLabel = formatPlanStepImpactLabel({
        stepNumber: 15,
        phaseId: "conversion",
        title: "Place actions",
        instruction: "Add links",
        context: {
          targetKeywords: [],
          expectedEffect: "More calls",
          revenueImpact: 100,
          projectionConfidence: "high",
        },
        tasks: [],
        status: "pending",
      });
      assert.equal(calibratedLabel, "+$100/mo est.");

      const engagement = estimateStepEngagementImpact(audit, 15, calibration);
      assert.ok((engagement ?? 0) > 0);
    });
  });

  describe("R4 — media coverage over volume", () => {
    it("treats coverage-complete photos as satisfied and demotes media under conversion mode", () => {
      const audit = createTestAudit();
      audit.gbp.content.photoCount = 30;
      audit.gbp.content.mediaCoverage = {
        totalCount: 30,
        ownerPhotoCount: 25,
        customerPhotoCount: 5,
        hasCover: true,
        hasLogo: true,
        hasExterior: true,
        hasInterior: true,
        hasTeam: true,
        hasAtWork: true,
        hasVideo: false,
        categoryCount: 5,
        missingCategories: [],
        coverageScore: 80,
        totalViews: 1000,
        ownerTotalViews: 800,
        ownerAvgViews: 32,
        ownerZeroViewCount: 0,
        customerPhotoShare: 0.2,
        engagementScore: 70,
        daysSinceLastUpload: 3,
        photoViewsAvailable: true,
      };
      assert.equal(photoCoverageIsHealthy(audit), true);
      assert.equal(isStepSatisfied(audit, 6), true);

      const converting = createTestAudit();
      converting.rankings.keywordsInPack = 3;
      converting.rankings.totalKeywords = 3;
      converting.rankings.keywords = converting.rankings.keywords.map((kw) => ({
        ...kw,
        inLocalPack: true,
        localPackPosition: 2 as const,
        geoRanks: kw.geoRanks.map((g) => ({ ...g, rank: 2, inLocalPack: true })),
      }));
      converting.gbp.content.photoCount = 80;
      converting.gbp.performance.profileViews = 500;
      converting.gbp.performance.calls = 3;
      converting.gbp.performance.directionRequests = 2;
      converting.gbp.performance.websiteClicks = 0;
      converting.gbp.performance.coverage = {
        apiAvailable: true,
        partialApi: false,
        coverageScore: 70,
        hasCoreMetrics: true,
        hasImpressionMetrics: true,
        hasSearchKeywords: true,
        hasConversations: false,
        hasBookings: false,
        keywordCount: 3,
        trackedKeywordCount: 3,
        totalActions: 5,
        actionRate: 1,
        endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "ok" },
        recommendations: [],
      };
      converting.gbp.placeActions = {
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

      assert.equal(auditPrefersConversionOverRank(converting), true);
      assert.ok(
        planStepImpactScore(converting, 15, 350) >
          planStepImpactScore(converting, 6, 350)
      );
    });
  });

  describe("R5 — batch approve impact order", () => {
    it("orders pending approvals by revenue/leads/engagement impact", () => {
      const tasks: ExecutionTask[] = [
        {
          id: "early",
          auditId: "a",
          actionItemId: "gbp-step-3",
          type: "gbp_description",
          title: "Description",
          description: "",
          priority: "P0",
          status: "pending_approval",
          draftContent: "x",
          payload: { gbpStepNumber: 3, projectedRevenueGain: 40 },
          requiresApproval: true,
          scheduledFor: null,
          completedAt: null,
          result: null,
          createdAt: "2026-07-03T00:00:00.000Z",
          planStepNumber: 3,
        },
        {
          id: "later-higher",
          auditId: "a",
          actionItemId: "gbp-step-15",
          type: "gbp_place_action",
          title: "Place actions",
          description: "",
          priority: "P2",
          status: "pending_approval",
          draftContent: null,
          payload: { gbpStepNumber: 15, projectedRevenueGain: 400 },
          requiresApproval: true,
          scheduledFor: null,
          completedAt: null,
          result: null,
          createdAt: "2026-07-03T00:00:00.000Z",
          planStepNumber: 15,
        },
      ];

      const sorted = sortPendingTasks(tasks);
      assert.equal(sorted[0]?.id, "later-higher");
      assert.equal(sorted[1]?.id, "early");
    });
  });

  describe("R6 — keyword playbooks + custom signal", () => {
    it("builds playbooks with primary CTAs and keeps custom steps from blank impact", () => {
      const audit = createTestAudit();
      const plan = buildPlan(audit, audit.execution!.tasks);
      assert.ok(plan);

      const playbooks = buildKeywordPlaybooks(audit, plan, { limit: 3 });
      assert.ok(playbooks.length >= 1 && playbooks.length <= 3);
      for (const playbook of playbooks) {
        assert.ok(playbook.ctaLabel.length > 0);
        assert.ok(playbook.rationale.length > 0);
        if (playbook.primaryStep != null) {
          const linked = resolveBestPlanStepForKeyword(audit, plan, playbook.keyword);
          assert.equal(linked, playbook.primaryStep);
        }
      }

      const customSignal = formatCustomPlanStepSignal({
        stepNumber: 19,
        phaseId: "ongoing",
        title: "Custom",
        instruction: "Do it",
        context: {
          targetKeywords: ["emergency plumber dallas"],
          expectedEffect: "Mention emergency response in the next post.",
          selectionRationale: "Pack leaders already use urgency language.",
          revenueImpact: null,
          leadsImpact: null,
        },
        tasks: [],
        status: "needs_approval",
      });
      assert.equal(customSignal, "Pack leaders already use urgency language.");
      assert.match(
        formatPlanStepImpactLabel(
          {
            stepNumber: 19,
            phaseId: "ongoing",
            title: "Custom",
            instruction: "Do it",
            context: {
              targetKeywords: [],
              expectedEffect: "Mention emergency response in the next post.",
              selectionRationale: "Pack leaders already use urgency language.",
              revenueImpact: null,
            },
            tasks: [],
            status: "pending",
          },
          "USD"
        ) ?? "",
        /urgency language/
      );
    });
  });
});
