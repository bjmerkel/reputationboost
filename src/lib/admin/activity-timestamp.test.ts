import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  latestScoreDateForBusinesses,
  maxActivityTimestamp,
  scoreDateToIso,
} from "./activity-timestamp";

describe("maxActivityTimestamp", () => {
  it("prefers the newest audit or score snapshot date", () => {
    assert.equal(
      maxActivityTimestamp("2026-07-01T10:00:00.000Z", "2026-08-03"),
      scoreDateToIso("2026-08-03")
    );
    assert.equal(
      maxActivityTimestamp("2026-08-04T10:00:00.000Z", "2026-08-03"),
      "2026-08-04T10:00:00.000Z"
    );
  });

  it("ignores invalid values", () => {
    assert.equal(maxActivityTimestamp(null, undefined, "not-a-date", "2026-08-01"), scoreDateToIso("2026-08-01"));
    assert.equal(maxActivityTimestamp(), null);
  });
});

describe("latestScoreDateForBusinesses", () => {
  it("returns the newest score date across businesses", () => {
    const scoreByBusiness = new Map([
      ["b1", { score_date: "2026-07-10" }],
      ["b2", { score_date: "2026-08-03" }],
    ]);

    assert.equal(latestScoreDateForBusinesses(["b1", "b2"], scoreByBusiness), "2026-08-03");
  });
});
