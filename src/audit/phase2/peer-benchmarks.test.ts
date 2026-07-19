import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { resolveConversionChannelBias } from "./conversion-channel";
import {
  buildPeerActionBenchmarks,
  keywordReviewOpportunityScore,
  resolveWeakActionRateThresholdPct,
} from "./peer-benchmarks";
import { detectGaps } from "./gaps";

describe("peer-benchmarks", () => {
  it("builds peer benchmarks with review median from pack leaders", () => {
    const audit = createTestAudit();
    const peer = buildPeerActionBenchmarks(audit);
    assert.ok(peer.reviewCountP50 > 0);
    assert.equal(peer.confidence, "peer");
    assert.ok(peer.actionRateTargetPct >= 3);
  });

  it("falls back to category confidence with a single tracked keyword leader", () => {
    const audit = createTestAudit();
    audit.rankings.keywords = [audit.rankings.keywords[0]!];
    const peer = buildPeerActionBenchmarks(audit);
    assert.equal(peer.confidence, "category");
  });

  it("ranks review opportunity by impressions × review gap", () => {
    const high = keywordReviewOpportunityScore(1200, 120);
    const low = keywordReviewOpportunityScore(100, 20);
    assert.ok(high > low);
  });

  it("uses peer-adjusted weak action threshold for in-pack plumbers", () => {
    const audit = createTestAudit();
    audit.rankings.keywordsInPack = 3;
    audit.rankings.totalKeywords = 3;
    audit.gbp.identity.primaryCategory = "Plumber";
    const threshold = resolveWeakActionRateThresholdPct(audit);
    assert.ok(threshold >= 3);
  });

  it("detects calls channel bias when calls lag peer-adjusted targets", () => {
    const audit = createTestAudit();
    audit.gbp.identity.primaryCategory = "Plumber";
    audit.rankings.keywordsInPack = 3;
    audit.rankings.totalKeywords = 3;
    audit.gbp.performance.profileViews = 500;
    audit.gbp.performance.calls = 1;
    audit.gbp.performance.directionRequests = 40;
    audit.gbp.performance.websiteClicks = 5;
    assert.equal(resolveConversionChannelBias(audit), "calls");
  });

  it("uses dynamic weak conversion threshold in gap detection", () => {
    const audit = createTestAudit();
    audit.gbp.performance.profileViews = 500;
    audit.gbp.performance.calls = 4;
    audit.gbp.performance.directionRequests = 4;
    audit.gbp.performance.websiteClicks = 4;
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
      totalActions: 12,
      actionRate: 2.4,
      endpoints: { coreMetrics: "ok", impressions: "ok", searchKeywords: "skipped" },
      recommendations: [],
    };
    const weak = detectGaps(audit).find((gap) => gap.id === "weak-profile-conversions");
    assert.ok(weak, "expected weak conversion gap when action rate is below peer threshold");
  });
});
