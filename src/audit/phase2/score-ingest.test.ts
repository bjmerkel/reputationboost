import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datesMissingScoreSnapshots } from "./score-ingest";

describe("datesMissingScoreSnapshots", () => {
  it("returns rank dates without an existing score row", () => {
    const missing = datesMissingScoreSnapshots(
      ["2026-07-08", "2026-07-09", "2026-07-09"],
      ["2026-07-09"]
    );

    assert.deepEqual(missing, ["2026-07-08"]);
  });

  it("returns an empty list when every rank date already has a score", () => {
    const missing = datesMissingScoreSnapshots(
      ["2026-07-08", "2026-07-09"],
      ["2026-07-08", "2026-07-09"]
    );

    assert.deepEqual(missing, []);
  });
});
