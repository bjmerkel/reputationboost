import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCompetitorTextQuery } from "./local-rankings";

describe("buildCompetitorTextQuery", () => {
  it("appends city/state when keyword does not mention the city", () => {
    assert.equal(
      buildCompetitorTextQuery("car stereo installer", "Arlington, Virginia"),
      "car stereo installer in Arlington, Virginia"
    );
  });

  it("skips redundant location when keyword already includes the city", () => {
    assert.equal(
      buildCompetitorTextQuery("best car electronics shop arlington", "Arlington, Virginia"),
      "best car electronics shop arlington"
    );
  });

  it("returns keyword unchanged when no location label is provided", () => {
    assert.equal(buildCompetitorTextQuery("car audio shop"), "car audio shop");
  });
});
