import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { manualRefreshCooldown } from "./cooldown";
import { taskCanAffectLocalRank } from "./gbp-change-detector";
import { nextScheduledRankPulse } from "./status";

describe("manualRefreshCooldown", () => {
  it("allows the first refresh and blocks subsequent refreshes for seven days", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    assert.equal(manualRefreshCooldown(null, now, 7).canRefresh, true);

    const blocked = manualRefreshCooldown(
      "2026-07-10T12:00:00.000Z",
      now,
      7
    );
    assert.equal(blocked.canRefresh, false);
    assert.equal(blocked.availableAt, "2026-07-17T12:00:00.000Z");
  });
});

describe("taskCanAffectLocalRank", () => {
  it("schedules delayed checks for ranking-signal profile changes", () => {
    assert.equal(taskCanAffectLocalRank("gbp_primary_category"), true);
    assert.equal(taskCanAffectLocalRank("gbp_description"), true);
    assert.equal(taskCanAffectLocalRank("review_response"), false);
    assert.equal(taskCanAffectLocalRank("social_post"), false);
  });
});

describe("nextScheduledRankPulse", () => {
  it("returns the next first-or-fifteenth UTC pulse", () => {
    assert.equal(
      nextScheduledRankPulse(new Date("2026-07-14T12:00:00.000Z")),
      "2026-07-15T06:00:00.000Z"
    );
    assert.equal(
      nextScheduledRankPulse(new Date("2026-07-15T07:00:00.000Z")),
      "2026-08-01T06:00:00.000Z"
    );
  });
});
