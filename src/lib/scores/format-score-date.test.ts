import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatScoreCalculatedAt,
  resolveScoreCalculatedAt,
} from "./format-score-date";

describe("formatScoreCalculatedAt", () => {
  it("formats YYYY-MM-DD dates", () => {
    assert.equal(formatScoreCalculatedAt("2026-07-14"), "Jul 14, 2026");
  });

  it("formats ISO timestamps", () => {
    assert.equal(
      formatScoreCalculatedAt("2026-07-03T12:05:00.000Z"),
      "Jul 3, 2026"
    );
  });
});

describe("resolveScoreCalculatedAt", () => {
  it("prefers nightly score snapshot date", () => {
    assert.equal(
      resolveScoreCalculatedAt("2026-07-14", {
        completedAt: "2026-07-01T00:00:00.000Z",
      } as never),
      "2026-07-14"
    );
  });

  it("falls back to audit completion date", () => {
    assert.equal(
      resolveScoreCalculatedAt(null, {
        completedAt: "2026-07-03T12:05:00.000Z",
      } as never),
      "2026-07-03"
    );
  });

  it("returns null when no date is available", () => {
    assert.equal(resolveScoreCalculatedAt(null, null), null);
  });
});
