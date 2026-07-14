import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeLiveAuditState } from "@/audit/live-audit-merge";
import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import { applyRankSnapshotsToAudit } from "@/audit/phase2/score-snapshot";

function minimalAudit(overrides: Partial<FullAuditPayload> = {}): FullAuditPayload {
  return {
    clientId: "test-co",
    clientName: "Test Co",
    userId: "user-1",
    auditId: "2026-07-01",
    trigger: "manual",
    period: "July 2026",
    startedAt: "2026-07-01T10:00:00.000Z",
    completedAt: "2026-07-01T10:05:00.000Z",
    gbp: {} as FullAuditPayload["gbp"],
    rankings: {
      collectedAt: "2026-07-01T10:00:00.000Z",
      keywords: [],
      keywordsInPack: 0,
      totalKeywords: 0,
      shareOfVoice: 0,
    },
    competitors: [],
    reviews: {} as FullAuditPayload["reviews"],
    offGoogle: {} as FullAuditPayload["offGoogle"],
    strategy: {
      generatedAt: "2026-07-01T10:05:00.000Z",
      executiveSummary: "stored",
      biggestWin: null,
      biggestThreat: "threat",
      localPackStatus: "0/0",
      kpiTargets: [],
      scores: {
        overall: 50,
        grade: "at_risk",
        driverScore: 50,
        outcomeIndex: 50,
        visibility: 50,
        conversion: 50,
        revenueCapture: 50,
        insight: { weakestComponent: "conversion", topOpportunityKeyword: null, nextAction: null },
        gbpCompleteness: 50,
        localPackCoverage: 0,
        reviewStrength: 50,
        engagement: 0,
        competitiveGap: 50,
        engagementOutcomes: {
          calls: 0,
          directions: 0,
          websiteClicks: 0,
          profileViews: 0,
        },
      },
      gaps: [],
      actionPlan: [],
      monthOverMonth: null,
      monthlyReport: null,
      gbpPlan: null,
    },
    execution: {
      generatedAt: "2026-07-01T10:05:00.000Z",
      tasks: [{ id: "task-1", status: "pending_approval" } as ExecutionTask],
    },
    ...overrides,
  };
}

describe("mergeLiveAuditState", () => {
  it("keeps audit identity and execution tasks from the current audit", () => {
    const current = minimalAudit();
    const live = minimalAudit({
      strategy: {
        ...current.strategy,
        scores: { ...current.strategy.scores, overall: 62 },
        executiveSummary: "live gaps refreshed",
      },
      auditId: "2026-07-09",
      trigger: "ingest",
    });

    const merged = mergeLiveAuditState(current, live);

    assert.equal(merged.auditId, "2026-07-01");
    assert.equal(merged.trigger, "manual");
    assert.equal(merged.execution?.tasks[0]?.id, "task-1");
    assert.equal(merged.strategy.scores.overall, 62);
    assert.equal(merged.strategy.executiveSummary, "live gaps refreshed");
  });
});

describe("radial rank hydration", () => {
  it("applies a normalized business-pin snapshot to a legacy audit", () => {
    const audit = minimalAudit({
      rankings: {
        collectedAt: "2026-07-01T10:00:00.000Z",
        keywords: [
          {
            keyword: "ac repair",
            localPackPosition: "not_in_pack",
            inLocalPack: false,
            geoRanks: [
              { distanceMiles: 1, rank: 8, inLocalPack: false },
              { distanceMiles: 3, rank: 10, inLocalPack: false },
            ],
            packLeaderRating: 0,
            packLeaderReviewCount: 0,
            clientRating: 0,
            clientReviewCount: 0,
          },
        ],
        keywordsInPack: 0,
        totalKeywords: 1,
        shareOfVoice: 0,
      },
    });

    const hydrated = applyRankSnapshotsToAudit(audit, [
      {
        businessId: "business-1",
        keyword: "ac repair",
        date: "2026-07-10",
        distanceMiles: 0,
        gridNorth: 0,
        gridEast: 0,
        rank: 2,
        inLocalPack: true,
        localPackPosition: 2,
        source: "api",
        rankingModel: "legacy_nearby_radius",
      },
    ]);

    assert.equal(hydrated.rankings.keywords[0]?.localPackPosition, 2);
    assert.equal(hydrated.rankings.keywords[0]?.inLocalPack, true);
    assert.equal(hydrated.rankings.keywords[0]?.observationSource, "observed");
  });

  it("marks carried-forward ranks as estimated", () => {
    const audit = minimalAudit({
      rankings: {
        collectedAt: "2026-07-01T10:00:00.000Z",
        keywords: [
          {
            keyword: "ac repair",
            localPackPosition: 2,
            inLocalPack: true,
            geoRanks: [],
            packLeaderRating: 4.8,
            packLeaderReviewCount: 100,
            clientRating: 4.6,
            clientReviewCount: 50,
          },
        ],
        keywordsInPack: 1,
        totalKeywords: 1,
        shareOfVoice: 100,
      },
    });
    const keyword = audit.rankings.keywords[0]!;
    const hydrated = applyRankSnapshotsToAudit(audit, [
      {
        businessId: "business-1",
        keyword: keyword.keyword,
        date: "2026-07-10",
        distanceMiles: 0,
        gridNorth: 0,
        gridEast: 0,
        rank: 2,
        inLocalPack: true,
        localPackPosition: 2,
        source: "deferred",
        rankingModel: "radial_text_v2",
      },
    ]);

    assert.equal(
      hydrated.rankings.keywords[0]?.observationSource,
      "carried_forward"
    );
  });
});
