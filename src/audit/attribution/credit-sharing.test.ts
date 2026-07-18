import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAttributionCredit,
  applyEngagementAttributionWeight,
  attributionWeightFromOverlap,
  countOverlappingPostWindows,
  formatAttributionCreditNote,
  postWindowsOverlap,
  seasonallyAdjustedEngagementDeltas,
} from "./credit-sharing";

describe("postWindowsOverlap", () => {
  it("detects overlapping 14-day post windows", () => {
    const a = new Date("2026-06-01T00:00:00.000Z");
    const b = new Date("2026-06-07T00:00:00.000Z");
    assert.equal(postWindowsOverlap(a, b, 14), true);
  });

  it("returns false when post windows are separated by more than 14 days", () => {
    const a = new Date("2026-06-01T00:00:00.000Z");
    const b = new Date("2026-06-20T00:00:00.000Z");
    assert.equal(postWindowsOverlap(a, b, 14), false);
  });
});

describe("countOverlappingPostWindows", () => {
  it("includes self and concurrent peers in overlap count", () => {
    const publishedAt = new Date("2026-06-01T00:00:00.000Z");
    const count = countOverlappingPostWindows(
      publishedAt,
      14,
      [
        { taskId: "self", publishedAt: publishedAt.toISOString() },
        { taskId: "peer-1", publishedAt: "2026-06-05T00:00:00.000Z" },
        { taskId: "peer-2", publishedAt: "2026-06-20T00:00:00.000Z" },
      ],
      "self"
    );
    assert.equal(count, 2);
  });
});

describe("attributionWeightFromOverlap", () => {
  it("splits credit evenly across overlapping actions", () => {
    assert.equal(attributionWeightFromOverlap(1), 1);
    assert.equal(attributionWeightFromOverlap(2), 0.5);
    assert.equal(attributionWeightFromOverlap(4), 0.25);
  });
});

describe("seasonallyAdjustedEngagementDeltas", () => {
  it("removes prior-period trend from raw deltas", () => {
    const priorBaseline = {
      calls: 10,
      direction_requests: 20,
      website_clicks: 5,
      impressions_maps: 100,
      impressions_search: 50,
    };
    const pre = {
      calls: 12,
      direction_requests: 22,
      website_clicks: 6,
      impressions_maps: 110,
      impressions_search: 55,
    };
    const post = {
      calls: 30,
      direction_requests: 40,
      website_clicks: 10,
      impressions_maps: 150,
      impressions_search: 70,
    };

    const adjusted = seasonallyAdjustedEngagementDeltas(pre, post, priorBaseline);
    // Raw calls delta = 18; prior trend = +2 → adjusted = 16
    assert.equal(adjusted.calls, 16);
    assert.equal(adjusted.directions, 16);
    assert.equal(adjusted.websiteClicks, 3);
  });
});

describe("applyEngagementAttributionWeight", () => {
  it("scales engagement deltas by overlap weight", () => {
    const scaled = applyEngagementAttributionWeight(
      { calls: 20, directions: 10, websiteClicks: 6, impressions: 100 },
      0.5
    );
    assert.equal(scaled.calls, 10);
    assert.equal(scaled.directions, 5);
    assert.equal(scaled.websiteClicks, 3);
  });
});

describe("applyAttributionCredit", () => {
  const totals = {
    calls: 10,
    direction_requests: 10,
    website_clicks: 5,
    impressions_maps: 100,
    impressions_search: 50,
  };

  it("shares engagement credit when actions overlap", () => {
    const credit = applyAttributionCredit({
      pre: totals,
      post: { ...totals, calls: 30, direction_requests: 30 },
      priorBaseline: totals,
      rank: {
        rankBefore: 8,
        rankAfter: 5,
        rankDelta: -3,
        keywordsImproved: 2,
      },
      overlapCount: 2,
      canAffectRank: true,
    });

    assert.equal(credit.overlapCount, 2);
    assert.equal(credit.engagement.calls, 10);
    assert.equal(credit.rank.rankAfter, 6);
    assert.equal(credit.rank.rankDelta, -2);
  });

  it("excludes rank credit for conversion-only actions", () => {
    const credit = applyAttributionCredit({
      pre: totals,
      post: { ...totals, calls: 25 },
      priorBaseline: totals,
      rank: {
        rankBefore: 8,
        rankAfter: 5,
        rankDelta: -3,
        keywordsImproved: 2,
      },
      overlapCount: 1,
      canAffectRank: false,
    });

    assert.equal(credit.rank.rankBefore, null);
    assert.equal(credit.rank.rankAfter, null);
    assert.equal(credit.rank.keywordsImproved, 0);
    assert.equal(credit.engagement.calls, 15);
  });
});

describe("formatAttributionCreditNote", () => {
  it("describes overlap sharing and rank exclusion", () => {
    assert.match(
      formatAttributionCreditNote(2, false) ?? "",
      /credit shared across 2 concurrent actions/
    );
    assert.match(
      formatAttributionCreditNote(2, false) ?? "",
      /rank excluded/
    );
    assert.equal(formatAttributionCreditNote(1, true), null);
  });
});
