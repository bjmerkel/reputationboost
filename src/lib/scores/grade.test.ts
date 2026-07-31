import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gradeFromScore, gradeLabel } from "./grade";

describe("gradeFromScore", () => {
  it("maps scores to health grades", () => {
    assert.equal(gradeFromScore(85), "healthy");
    assert.equal(gradeFromScore(70), "healthy");
    assert.equal(gradeFromScore(55), "at_risk");
    assert.equal(gradeFromScore(40), "at_risk");
    assert.equal(gradeFromScore(25), "urgent");
  });
});

describe("gradeLabel", () => {
  it("returns readable labels", () => {
    assert.equal(gradeLabel("healthy"), "Healthy");
    assert.equal(gradeLabel("at_risk"), "At risk");
    assert.equal(gradeLabel("urgent"), "Urgent");
  });
});
