import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "../phase3/test-fixtures";
import { computeScoreDailySnapshot } from "./score-snapshot";
import { sanitizeScoreComponent, safeFiniteNumber } from "./score-sanitize";

describe("sanitizeScoreComponent", () => {
  it("clamps finite numbers to 0–100 integers", () => {
    assert.equal(sanitizeScoreComponent(42.6), 43);
    assert.equal(sanitizeScoreComponent(-5), 0);
    assert.equal(sanitizeScoreComponent(150), 100);
  });

  it("falls back when values are null, undefined, or NaN", () => {
    assert.equal(sanitizeScoreComponent(null), 0);
    assert.equal(sanitizeScoreComponent(undefined), 0);
    assert.equal(sanitizeScoreComponent(Number.NaN), 0);
    assert.equal(sanitizeScoreComponent("not-a-number", 12), 12);
  });
});

describe("safeFiniteNumber", () => {
  it("returns finite numbers unchanged", () => {
    assert.equal(safeFiniteNumber(4.2), 4.2);
  });

  it("falls back for non-finite values", () => {
    assert.equal(safeFiniteNumber(undefined, 3.5), 3.5);
    assert.equal(safeFiniteNumber(Number.NaN, 0), 0);
  });
});

describe("computeScoreDailySnapshot", () => {
  it("returns finite score_daily fields when engagement metrics are missing", () => {
    const audit = createTestAudit();
    audit.gbp.engagement.averageRating = undefined as unknown as number;
    audit.gbp.engagement.responseRate = undefined as unknown as number;

    const snapshot = computeScoreDailySnapshot(audit, "2026-08-03");

    for (const field of [
      "overall",
      "visibility",
      "conversion",
      "revenueCapture",
      "driverScore",
      "outcomeIndex",
    ] as const) {
      assert.equal(Number.isFinite(snapshot[field]), true, field);
    }
  });
});
