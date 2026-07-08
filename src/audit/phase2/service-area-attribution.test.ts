import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "../phase3/test-fixtures";
import {
  buildKeywordFromRadiusMedians,
  buildServiceAreaRankMovements,
  medianRanksByRadius,
  serviceAreaImproved,
  weakestRadiusImproved,
} from "./service-area-attribution";
import { RADIUS_PROFILE_WEIGHTS } from "./radius-profiles";

describe("service-area-attribution", () => {
  it("medianRanksByRadius computes per-radius medians", () => {
    const medians = medianRanksByRadius([
      { distanceMiles: 1, rank: 3 },
      { distanceMiles: 1, rank: 5 },
      { distanceMiles: 3, rank: 6 },
      { distanceMiles: 3, rank: 8 },
      { distanceMiles: 5, rank: 10 },
    ]);

    assert.equal(medians.get(1), 4);
    assert.equal(medians.get(3), 7);
    assert.equal(medians.get(5), 10);
  });

  it("detects service-area improvement when wider radius gains pack position", () => {
    const audit = createTestAudit();
    const fragile = audit.rankings.keywords.find((k) => k.keyword === "plumber near me")!;
    const improved = buildKeywordFromRadiusMedians(
      fragile.keyword,
      new Map([
        [1, 3],
        [3, 2],
        [5, 3],
        [10, 4],
      ]),
      fragile
    );

    assert.equal(weakestRadiusImproved(fragile, improved), 3);
    assert.ok(serviceAreaImproved(fragile, improved, RADIUS_PROFILE_WEIGHTS.neighborhood));
  });

  it("buildServiceAreaRankMovements surfaces wider-radius gains when 1 mi is unchanged", () => {
    const audit = createTestAudit();
    const fragile = audit.rankings.keywords.find((k) => k.keyword === "plumber near me")!;
    const improved = buildKeywordFromRadiusMedians(
      fragile.keyword,
      new Map([
        [1, 3],
        [3, 2],
        [5, 3],
        [10, 4],
      ]),
      fragile
    );

    const movements = buildServiceAreaRankMovements(
      [fragile.keyword],
      new Map([[fragile.keyword, fragile]]),
      new Map([[fragile.keyword, improved]]),
      RADIUS_PROFILE_WEIGHTS.neighborhood
    );

    assert.equal(movements.length, 1);
    assert.equal(movements[0].fromPosition, 3);
    assert.equal(movements[0].toPosition, 3);
    assert.ok(movements[0].improved);
    assert.ok((movements[0].toServiceAreaVisibility ?? 0) > (movements[0].fromServiceAreaVisibility ?? 0));
  });
});
