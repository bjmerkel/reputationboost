import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "../phase3/test-fixtures";
import type { GapFlag } from "../types";
import { buildTemplateGbpPlan } from "./gbp-plan";
import {
  applyOutcomeGapMutation,
  cloneAudit,
  isStepSatisfied,
  keywordNeedsOutcomeWork,
  projectKeywordToRank1,
  projectOutcomeScoresFromActions,
  simulateActionMarginalImpact,
  simulateGapDriverImpact,
  simulateStepDriverImpact,
  projectHealthScoresFromStepNumbers,
} from "./counterfactual";
import { computeHealthScores, detectPackFragility } from "./scoring";
import { estimateStepHealthImpact } from "./score-impact";
import { buildPathToHealthy } from "./path-to-healthy";
import { detectGaps } from "./gaps";

describe("counterfactual score simulation", () => {
  it("returns zero impact for already-satisfied steps", () => {
    const audit = createTestAudit();
    const mutated = structuredClone(audit);
    mutated.gbp.content.photoCount = 80;
    assert.ok(isStepSatisfied(mutated, 6));
    assert.equal(simulateStepDriverImpact(mutated, 6), 0);
  });

  it("derives step impact from computeHealthScores counterfactuals", () => {
    const audit = createTestAudit();
    const before = computeHealthScores(audit).driverScore;

    for (const stepNumber of [3, 6, 8, 11]) {
      const impact = simulateStepDriverImpact(audit, stepNumber);
      assert.ok(
        impact >= 0,
        `step ${stepNumber} impact should be non-negative, got ${impact}`
      );
      if (impact > 0) {
        const projected = projectHealthScoresFromStepNumbers(audit, [stepNumber]);
        assert.equal(projected.driverGain, impact);
        assert.ok(projected.projectedDriverScore >= before);
      }
    }
  });

  it("matches estimateStepHealthImpact when no calibration data exists", () => {
    const audit = createTestAudit();
    for (let step = 1; step <= 16; step++) {
      assert.equal(
        estimateStepHealthImpact(audit, step),
        simulateStepDriverImpact(audit, step)
      );
    }
  });

  it("derives gap impact from computeHealthScores counterfactuals", () => {
    const audit = createTestAudit();
    const gaps = detectGaps(audit);
    const unresponded = gaps.find((g) => g.id === "unresponded-negative");
    assert.ok(unresponded);
    assert.ok(simulateGapDriverImpact(audit, unresponded!) > 0);

    const rankGap = gaps.find((g) => g.id.startsWith("rank-outside-pack"));
    assert.ok(rankGap);
    assert.equal(simulateGapDriverImpact(audit, rankGap!), 0);
  });

  it("derives positive driver impact for new API coverage gaps", () => {
    const audit = createTestAudit();
    const gaps: Array<{ id: string; setup: (a: ReturnType<typeof createTestAudit>) => void }> = [
      {
        id: "missing-place-action-links",
        setup: (a) => {
          a.gbp.placeActions = {
            apiAvailable: true,
            partialApi: false,
            coverageScore: 20,
            linkCount: 0,
            merchantLinkCount: 0,
            configuredTypes: [],
            availableTypes: ["APPOINTMENT", "ONLINE_APPOINTMENT"],
            missingRecommendedTypes: ["APPOINTMENT", "ONLINE_APPOINTMENT"],
            missingAvailableTypes: ["APPOINTMENT", "ONLINE_APPOINTMENT"],
            typeCatalog: [
              { placeActionType: "APPOINTMENT", displayName: "Book appointment" },
              { placeActionType: "ONLINE_APPOINTMENT", displayName: "Book online appointment" },
            ],
            hasAppointmentLink: false,
            hasOnlineAppointmentLink: false,
            hasDiningReservationLink: false,
            hasFoodOrderingLink: false,
            hasShopOnlineLink: false,
            endpoints: { links: "ok", typeMetadata: "ok" },
            recommendations: [],
          };
        },
      },
      {
        id: "rejected-review-replies",
        setup: (a) => {
          a.reviews.rejectedReplies = 2;
          a.gbp.reviewCoverage = {
            apiAvailable: true,
            partialApi: false,
            coverageScore: 50,
            reviewCount: 87,
            averageRating: 4.6,
            responseRate: 0.72,
            unrespondedCount: 5,
            unrespondedNegativeCount: 2,
            pendingReplies: 0,
            rejectedReplies: 2,
            reviewsLast30Days: 4,
            reviewsWithMedia: 0,
            avgResponseTimeHours: 36,
            endpoints: { list: "ok", get: "ok" },
            recommendations: [],
          };
        },
      },
      {
        id: "posts-without-cta",
        setup: (a) => {
          a.gbp.localPosts = {
            apiAvailable: true,
            partialApi: false,
            coverageScore: 55,
            postCount: 3,
            livePostCount: 3,
            rejectedPostCount: 0,
            processingPostCount: 0,
            postsLast30Days: 1,
            daysSinceLastPost: 20,
            topicTypesUsed: ["STANDARD"],
            hasOfferPost: false,
            hasEventPost: false,
            hasCallToActionPosts: false,
            hasMediaPosts: true,
            totalViews: 40,
            endpoints: { list: "ok", insights: "ok" },
            recommendations: [],
          };
        },
      },
      {
        id: "missing-pubsub-notifications",
        setup: (a) => {
          a.gbp.notifications = {
            configured: false,
            pubsubTopic: null,
            enabledTypes: [],
            missingRecommendedTypes: ["NEW_REVIEW", "GOOGLE_UPDATE"],
            deprecatedTypesEnabled: [],
            coverageScore: 0,
            hasReviewAlerts: false,
            hasGoogleUpdateAlerts: false,
            hasCustomerMediaAlerts: false,
            hasVoiceOfMerchantAlerts: false,
          };
        },
      },
    ];

    for (const { id, setup } of gaps) {
      const mutated = structuredClone(audit);
      setup(mutated);
      const gap = detectGaps(mutated).find((g) => g.id === id) ?? ({ id } as GapFlag);
      const impact = simulateGapDriverImpact(mutated, gap);
      assert.ok(impact > 0, `expected positive impact for ${id}, got ${impact}`);
    }
  });

  it("filters satisfied steps from the template plan", () => {
    const audit = createTestAudit();
    const plan = buildTemplateGbpPlan(audit);
    assert.ok(plan.steps.length > 0);
    assert.ok(plan.steps.length <= 17);
    for (const step of plan.steps) {
      assert.equal(isStepSatisfied(audit, step.stepNumber), false);
    }
  });

  it("projects path-to-healthy scores via recomputation, not additive heuristics", () => {
    const audit = createTestAudit();
    const path = buildPathToHealthy(audit);
    assert.ok(path);
    assert.ok(path!.steps.length > 0);
    assert.ok(path!.projectedDriverScore >= path!.currentDriverScore);
    assert.ok(path!.projectedScore >= path!.currentScore);
    assert.ok(path!.projectedOutcomeIndex >= path!.outcomeIndex);
    assert.ok(path!.projectedDriverScore <= 100);
    assert.ok(path!.projectedScore <= 100);
    assert.ok(path!.projectedOutcomeIndex <= 100);
  });

  it("projects ranking outcome gains from action-linked rank counterfactuals", () => {
    const audit = createTestAudit();
    const before = computeHealthScores(audit).outcomeIndex;
    const projection = projectOutcomeScoresFromActions(audit, [
      { source: "plan", id: "gbp-step-3" },
      { source: "plan", id: "gbp-step-8" },
    ]);

    assert.ok(projection.outcomeGain >= 0);
    assert.ok(projection.projectedOutcomeIndex >= before);
    assert.ok(projection.visibilityGain >= 0);
    assert.ok(projection.overallGain >= 0);
  });

  it("projects rank-outside-pack gaps into the local pack", () => {
    const audit = createTestAudit();
    const outsideKeyword = audit.rankings.keywords.find((k) => !k.inLocalPack)?.keyword;
    assert.ok(outsideKeyword);

    const projection = projectOutcomeScoresFromActions(audit, [
      { source: "gap", id: `rank-outside-pack-${outsideKeyword}` },
    ]);

    assert.ok(projection.outcomeGain > 0);
    assert.ok(projection.projectedOutcomeIndex > computeHealthScores(audit).outcomeIndex);
  });

  it("returns unified marginal impact for a candidate action", () => {
    const audit = createTestAudit();
    const gaps = detectGaps(audit);
    const unresponded = gaps.find((g) => g.id === "unresponded-negative");
    assert.ok(unresponded);

    const action = { source: "gap" as const, id: unresponded!.id };
    const marginal = simulateActionMarginalImpact(audit, [], action);

    assert.ok(marginal.driverGain >= 0);
    assert.equal(marginal.driverGain, simulateGapDriverImpact(audit, unresponded!));
    assert.ok(marginal.overallGain >= 0);
  });

  it("marginal driver gain decreases when actions overlap", () => {
    const audit = createTestAudit();
    const step3 = { source: "plan" as const, id: "gbp-step-3" };
    const step4 = { source: "plan" as const, id: "gbp-step-4" };

    const isolatedStep4 = simulateActionMarginalImpact(audit, [], step4).driverGain;
    const stackedStep4 = simulateActionMarginalImpact(audit, [step3], step4).driverGain;

    assert.ok(isolatedStep4 >= 0);
    assert.ok(stackedStep4 >= 0);
    assert.ok(stackedStep4 <= isolatedStep4);
  });

  it("includes revenue marginals when average customer value is set", () => {
    const audit = createTestAudit();
    const outsideKeyword = audit.rankings.keywords.find((k) => !k.inLocalPack)?.keyword;
    assert.ok(outsideKeyword);

    const withKeywords = {
      ...audit,
      gbp: {
        ...audit.gbp,
        performance: {
          ...audit.gbp.performance,
          searchKeywords: audit.rankings.keywords.map((kw) => ({
            keyword: kw.keyword,
            impressions: 800,
            belowThreshold: false,
          })),
        },
      },
    };

    const action = {
      source: "gap" as const,
      id: `rank-outside-pack-${outsideKeyword}`,
    };
    const marginal = simulateActionMarginalImpact(withKeywords, [], action, {
      avgCustomerValue: 350,
    });

    assert.ok(marginal.outcomeGain > 0);
    assert.ok(marginal.revenueGain != null);
    assert.ok(marginal.revenueGain! > 0);
  });

  it("flags pack-fragile in-pack keywords as needing outcome work", () => {
    const audit = createTestAudit();
    const fragile = audit.rankings.keywords.find((k) => k.keyword === "plumber near me");
    assert.ok(fragile);
    assert.ok(fragile!.inLocalPack);
    assert.ok(keywordNeedsOutcomeWork(fragile!));
    assert.ok(detectPackFragility(fragile!).fragile);
  });

  it("projectKeywordToRank1 sets rank 1 at every search radius", () => {
    const audit = createTestAudit();
    const fragile = audit.rankings.keywords.find((k) => k.keyword === "plumber near me");
    assert.ok(fragile);

    const projected = projectKeywordToRank1(fragile!);
    for (const g of projected.geoRanks) {
      assert.equal(g.rank, 1);
      assert.equal(g.inLocalPack, true);
    }
    assert.equal(projected.localPackPosition, 1);
  });

  it("projects pack-fragility gaps into wider-radius pack positions", () => {
    const audit = createTestAudit();
    const gaps = detectGaps(audit);
    const fragileGap = gaps.find((g) => g.id === "pack-fragility-plumber near me");
    assert.ok(fragileGap);
    assert.match(fragileGap!.description, /1 mi:.*3 mi:/);

    const mutated = cloneAudit(audit);
    applyOutcomeGapMutation(mutated, fragileGap!);
    const kw = mutated.rankings.keywords.find((k) => k.keyword === "plumber near me");
    assert.ok(kw);
    assert.equal(kw!.geoRanks.find((g) => g.distanceMiles === 3)?.rank, 3);
    assert.equal(kw!.geoRanks.find((g) => g.distanceMiles === 5)?.rank, 3);
    assert.equal(detectPackFragility(kw!).fragile, false);
  });

  it("prioritizes pack-fragile keywords in GBP plan posts", () => {
    const audit = createTestAudit();
    const plan = buildTemplateGbpPlan(audit);
    const postsStep = plan.steps.find((s) => s.stepNumber === 8);
    assert.ok(postsStep);
    assert.ok(postsStep!.bullets?.some((b) => b.includes("plumber near me")));
    const fragilePriority = plan.keywordPriority.find((k) => k.keyword === "plumber near me");
    assert.ok(fragilePriority);
    assert.match(fragilePriority!.reason, /fragile|service-area/i);
  });
});
