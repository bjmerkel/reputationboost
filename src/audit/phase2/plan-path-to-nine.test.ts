import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { buildPlan } from "@/audit/phase3/build-plan";
import { selectNextBestPlanSteps } from "@/audit/phase3/plan-next-actions";
import { detectGaps } from "./gaps";
import {
  buildTemplateGbpPlan,
  orderGbpPlanStepsByImpact,
  planStepImpactScore,
} from "./gbp-plan";
import { auditPrefersConversionOverRank } from "./conversion-boost";
import { CONVERSION_PLAN_STEPS } from "./conversion-constants";
import {
  applyStepMutation,
  projectOutcomeScoresFromActions,
} from "./counterfactual";
import { buildAttributionCalibration } from "./attribution-calibration";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { estimateStepEngagementImpact } from "./score-impact";
import { resolveConversionChannelBias } from "./conversion-channel";
import { buildPathToHealthy } from "./path-to-healthy";

function attribution(
  overrides: Partial<ActionAttribution> & Pick<ActionAttribution, "actionItemId">
): ActionAttribution {
  return {
    id: "a1",
    executionTaskId: "t1",
    businessId: "b1",
    taskType: "gbp_place_action",
    title: "x",
    publishedAt: "2026-06-01T00:00:00.000Z",
    windowDays: 14,
    primaryKeyword: "plumber near me",
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
    preliminary: false,
    computedAt: "2026-06-15T00:00:00.000Z",
    ...overrides,
  };
}

function withPerfCoverage(audit: ReturnType<typeof createTestAudit>, totalActions: number) {
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
    totalActions,
    actionRate:
      audit.gbp.performance.profileViews > 0
        ? Math.round((totalActions / audit.gbp.performance.profileViews) * 1000) / 10
        : 0,
    endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "ok" },
    recommendations: [],
  };
  return audit;
}

function conversionVisibleAudit() {
  const audit = createTestAudit();
  audit.gbp.performance.profileViews = 500;
  audit.gbp.performance.calls = 0;
  audit.gbp.performance.directionRequests = 0;
  audit.gbp.performance.websiteClicks = 0;
  withPerfCoverage(audit, 0);
  audit.rankings.keywordsInPack = 3;
  audit.rankings.totalKeywords = 3;
  audit.rankings.keywords = audit.rankings.keywords.map((kw) => ({
    ...kw,
    inLocalPack: true,
    localPackPosition: 2,
    geoRanks: kw.geoRanks.map((g) => ({ ...g, rank: 2, inLocalPack: true })),
  }));
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

describe("Plan path-to-9 golden fixtures", () => {
  it("visible + zero actions → conversion gaps are P0 and NBA is conversion-first", () => {
    const audit = conversionVisibleAudit();
    assert.equal(auditPrefersConversionOverRank(audit), true);

    const conversionGaps = detectGaps(audit).filter(
      (gap) =>
        gap.id === "low-profile-conversions" || gap.id === "weak-profile-conversions"
    );
    assert.ok(conversionGaps.length > 0);
    assert.ok(conversionGaps.every((gap) => gap.priority === "P0"));

    const gbpPlan = buildTemplateGbpPlan(audit, { avgCustomerValue: 350 });
    audit.strategy.gbpPlan = gbpPlan;
    const plan = buildPlan(
      audit,
      audit.execution?.tasks ?? [],
      [],
      undefined,
      350
    );
    assert.ok(plan);
    const nba = selectNextBestPlanSteps(plan!, 3, { preferConversionSteps: true });
    assert.ok(nba.length > 0);
    assert.ok(
      nba.every((step) =>
        (CONVERSION_PLAN_STEPS as readonly number[]).includes(step.stepNumber)
      ),
      `NBA should be conversion-family, got ${nba.map((s) => s.stepNumber).join(",")}`
    );
  });

  it("calibration with sample≥2 reorders displayOrder toward what worked (15 ≫ 8)", () => {
    const audit = conversionVisibleAudit();
    const calibration = buildAttributionCalibration([
      attribution({
        id: "a1",
        executionTaskId: "t1",
        actionItemId: "gbp-step-15",
        callsDelta: 40,
        directionsDelta: 60,
        websiteClicksDelta: 50,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-15",
        callsDelta: 36,
        directionsDelta: 55,
        websiteClicksDelta: 48,
      }),
      attribution({
        id: "a3",
        executionTaskId: "t3",
        actionItemId: "gbp-step-8",
        taskType: "google_post",
        callsDelta: 0,
        directionsDelta: 0,
        websiteClicksDelta: 0,
      }),
      attribution({
        id: "a4",
        executionTaskId: "t4",
        actionItemId: "gbp-step-8",
        taskType: "google_post",
        callsDelta: 0,
        directionsDelta: 0,
        websiteClicksDelta: 0,
      }),
    ]);

    assert.ok(
      (estimateStepEngagementImpact(audit, 15, calibration) ?? 0) >
        (estimateStepEngagementImpact(audit, 8, calibration) ?? 0)
    );
    assert.ok(
      planStepImpactScore(audit, 15, 350, calibration) >
        planStepImpactScore(audit, 8, 350, calibration)
    );

    const steps = [
      { stepNumber: 8, title: "Posts", instruction: "post" },
      { stepNumber: 15, title: "Place actions", instruction: "links" },
    ];
    const ordered = orderGbpPlanStepsByImpact(audit, steps, 350, calibration);
    assert.equal(ordered[0]?.stepNumber, 15);
    assert.equal(ordered[0]?.displayOrder, 0);
  });

  it("uncalibrated rank claims stay conservative (step 3 delta capped)", () => {
    const audit = createTestAudit();
    const before = audit.rankings.keywords
      .filter((k) => !k.inLocalPack)
      .map((k) => k.localPackPosition);
    const projection = projectOutcomeScoresFromActions(
      audit,
      [{ source: "plan", id: "gbp-step-3" }],
      { avgCustomerValue: 350 }
    );
    // With conservative rank deltas, revenue gain should be modest / labeled via model.
    assert.ok(projection.revenueGain == null || projection.revenueGain < 5000);
    void before;
  });

  it("step 5 mutation adds priority services; step 1 mutates primary only", () => {
    const audit = createTestAudit();
    // Force step 1 to be a real change.
    audit.gbp.liveProfile!.primaryCategory = "Contractor";
    audit.gbp.identity.primaryCategory = "Plumber";

    const beforeSecondary = [...(audit.gbp.liveProfile!.secondaryCategories ?? [])];
    const beforeServices = audit.gbp.liveProfile!.services.length;

    applyStepMutation(audit, 1);
    assert.equal(audit.gbp.liveProfile!.primaryCategory, "Plumber");
    assert.deepEqual(audit.gbp.liveProfile!.secondaryCategories, beforeSecondary);

    applyStepMutation(audit, 5);
    assert.ok(audit.gbp.liveProfile!.services.length >= beforeServices);
  });

  it("path-to-healthy with plan prefers displayOrder and skips rank teleport gaps", () => {
    const audit = conversionVisibleAudit();
    const gbpPlan = buildTemplateGbpPlan(audit, { avgCustomerValue: 350 });
    audit.strategy.gbpPlan = gbpPlan;
    // Inject a rank-outside-pack gap that must not drive the header alone.
    audit.strategy.gaps = [
      ...(audit.strategy.gaps ?? []),
      {
        id: "rank-outside-pack-emergency plumber dallas",
        priority: "P0",
        category: "rankings",
        title: "Outside pack",
        description: "test",
        impact: 8,
        effort: 3,
        impactScore: 64,
      },
    ];
    const plan = buildPlan(
      audit,
      audit.execution?.tasks ?? [],
      [],
      undefined,
      350
    );
    assert.ok(plan);
    const path = buildPathToHealthy(audit, plan, {
      avgCustomerValue: 350,
      preferPlanDisplayOrder: true,
    });
    assert.ok(path);
    assert.ok(
      path!.steps.every((step) => step.source === "plan"),
      "plan-order path should use plan steps only"
    );
    assert.ok(
      !path!.steps.some((step) => step.id.startsWith("rank-outside-pack")),
      "rank teleport gaps must not appear in plan-order path"
    );
  });

  it("channel bias prefers calls when directions are healthy but calls are near zero", () => {
    const audit = conversionVisibleAudit();
    audit.gbp.performance.calls = 0;
    audit.gbp.performance.directionRequests = 40;
    audit.gbp.performance.websiteClicks = 5;
    withPerfCoverage(audit, 45);
    assert.equal(resolveConversionChannelBias(audit), "calls");
  });

  it("effort-aware scoring demotes slow review requests vs place actions when impacts are close", () => {
    const audit = conversionVisibleAudit();
    // Place actions (effort 2) should beat review requests (effort 7) in conversion mode
    // when both are unfinished conversion/reputation work — at least vs media.
    assert.ok(
      planStepImpactScore(audit, 15, 350) > planStepImpactScore(audit, 6, 350)
    );
  });

  it("zero-result calibration demotes failed steps below proven winners", () => {
    const audit = conversionVisibleAudit();
    const calibration = buildAttributionCalibration([
      attribution({
        id: "a1",
        executionTaskId: "t1",
        actionItemId: "gbp-step-8",
        taskType: "google_post",
        callsDelta: 0,
        directionsDelta: 0,
        websiteClicksDelta: 0,
        rankBefore: 5,
        rankAfter: 6,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-8",
        taskType: "google_post",
        callsDelta: 0,
        directionsDelta: 0,
        websiteClicksDelta: 0,
        rankBefore: 4,
        rankAfter: 5,
      }),
      attribution({
        id: "a3",
        executionTaskId: "t3",
        actionItemId: "gbp-step-15",
        callsDelta: 40,
        directionsDelta: 60,
        websiteClicksDelta: 50,
      }),
      attribution({
        id: "a4",
        executionTaskId: "t4",
        actionItemId: "gbp-step-15",
        callsDelta: 36,
        directionsDelta: 55,
        websiteClicksDelta: 48,
      }),
    ]);

    const steps = [
      { stepNumber: 8, title: "Posts", instruction: "post" },
      { stepNumber: 15, title: "Place actions", instruction: "links" },
    ];
    const ordered = orderGbpPlanStepsByImpact(audit, steps, 350, calibration);
    assert.equal(ordered[0]?.stepNumber, 15);
    assert.ok(
      planStepImpactScore(audit, 15, 350, calibration) >
        planStepImpactScore(audit, 8, 350, calibration)
    );
  });

  it("zero-rank calibration suppresses rank lift projection for failed steps", () => {
    const audit = createTestAudit();
    const calibration = buildAttributionCalibration([
      attribution({
        actionItemId: "gbp-step-3",
        rankBefore: 6,
        rankAfter: 8,
      }),
      attribution({
        id: "a2",
        executionTaskId: "t2",
        actionItemId: "gbp-step-3",
        rankBefore: 5,
        rankAfter: 6,
      }),
    ]);

    const projection = projectOutcomeScoresFromActions(
      audit,
      [{ source: "plan", id: "gbp-step-3" }],
      { avgCustomerValue: 350, calibration }
    );
    const uncalibrated = projectOutcomeScoresFromActions(
      audit,
      [{ source: "plan", id: "gbp-step-3" }],
      { avgCustomerValue: 350 }
    );

    assert.ok(
      (projection.outcomeGain ?? 0) < (uncalibrated.outcomeGain ?? 0),
      "negative rank evidence should reduce projected outcome gain"
    );
  });

  it("uncalibrated rank priors differentiate description from posts", () => {
    const audit = createTestAudit();
    const description = projectOutcomeScoresFromActions(
      audit,
      [{ source: "plan", id: "gbp-step-3" }],
      { avgCustomerValue: 350 }
    );
    const posts = projectOutcomeScoresFromActions(
      audit,
      [{ source: "plan", id: "gbp-step-8" }],
      { avgCustomerValue: 350 }
    );

    assert.ok(
      (description.outcomeGain ?? 0) > (posts.outcomeGain ?? 0),
      "description should project more rank outcome than posts"
    );
  });
});
