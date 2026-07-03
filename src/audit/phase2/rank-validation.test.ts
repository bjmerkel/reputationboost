import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareRanksAtOneMile,
  summarizeRankValidation,
} from "./rank-validation";

describe("compareRanksAtOneMile", () => {
  it("detects pack disagreement when modes disagree on in-pack status", () => {
    const result = compareRanksAtOneMile("plumber near me", 3, 8);
    assert.equal(result.packDisagreement, true);
    assert.equal(result.nearbyInPack, true);
    assert.equal(result.textInPack, false);
    assert.equal(result.absRankDelta, 5);
  });

  it("reports no disagreement when ranks match", () => {
    const result = compareRanksAtOneMile("plumber near me", 2, 2);
    assert.equal(result.packDisagreement, false);
    assert.equal(result.rankDisagreement, false);
    assert.equal(result.rankDelta, 0);
  });
});

describe("summarizeRankValidation", () => {
  it("computes disagreement rates across a sample", () => {
    const summary = summarizeRankValidation([
      compareRanksAtOneMile("kw-a", 1, 1),
      compareRanksAtOneMile("kw-b", 3, 8),
      compareRanksAtOneMile("kw-c", 5, 6),
    ]);

    assert.equal(summary.keywordCount, 3);
    assert.equal(summary.packDisagreementCount, 1);
    assert.equal(summary.packDisagreementRate, 1 / 3);
    assert.equal(summary.rankDisagreementCount, 2);
    assert.equal(summary.meanAbsRankDelta, 2);
    assert.equal(summary.maxAbsRankDelta, 5);
  });
});
