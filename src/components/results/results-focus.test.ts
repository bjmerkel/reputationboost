import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLAN_CHANGELOG_SECTION_ID,
  resolveResultsFocus,
  resultsFocusMissMessage,
} from "./results-focus";

describe("resolveResultsFocus", () => {
  it("hits the step anchor when the Results row exists", () => {
    const resolution = resolveResultsFocus(8, (id) => id === "results-step-8");
    assert.deepEqual(resolution, { kind: "hit", elementId: "results-step-8" });
  });

  it("falls back to changelog and clears via miss when the row is missing", () => {
    const resolution = resolveResultsFocus(8, () => false);
    assert.deepEqual(resolution, {
      kind: "miss",
      sectionId: PLAN_CHANGELOG_SECTION_ID,
      stepNumber: 8,
    });
    assert.match(resultsFocusMissMessage(8), /step 8/);
  });
});
