import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PLACES_MONTHLY_CALL_BUDGET,
  MONTHLY_KEYWORD_CALL_RESERVATION,
  monthStartYmd,
  normalizeCollectionKeyword,
} from "./places-cost-governance";

describe("Places cost governance", () => {
  it("uses a monthly period key for idempotency and budgets", () => {
    assert.equal(monthStartYmd("2026-07-15"), "2026-07-01");
    assert.equal(
      monthStartYmd(new Date("2026-12-31T23:00:00.000Z")),
      "2026-12-01"
    );
  });

  it("normalizes keyword claim keys", () => {
    assert.equal(
      normalizeCollectionKeyword("  Emergency   Plumber "),
      "emergency plumber"
    );
  });

  it("budgets three monthly grids plus two rank pulses with headroom", () => {
    const monthlyGridReservation = MONTHLY_KEYWORD_CALL_RESERVATION * 3;
    const twoEightKeywordPulses = 8 * 2;
    assert.ok(
      monthlyGridReservation + twoEightKeywordPulses <=
        DEFAULT_PLACES_MONTHLY_CALL_BUDGET
    );
  });
});
