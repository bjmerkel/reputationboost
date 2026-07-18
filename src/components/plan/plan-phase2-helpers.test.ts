import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countGoogleConflictTasks } from "./GoogleUpdatesPanel";
import { hasMaintenanceCadence } from "./PlanMaintenanceCadence";

describe("countGoogleConflictTasks", () => {
  it("counts accept and reject suggestion tasks only", () => {
    const tasks = [
      { type: "gbp_accept_suggestion" },
      { type: "gbp_reject_suggestion" },
      { type: "review_response" },
      { type: "gbp_description" },
    ] as Parameters<typeof countGoogleConflictTasks>[0];

    assert.equal(countGoogleConflictTasks(tasks), 2);
  });
});

describe("hasMaintenanceCadence", () => {
  it("is false when both cadences are empty", () => {
    assert.equal(hasMaintenanceCadence([], []), false);
  });

  it("is true when either cadence has items", () => {
    assert.equal(hasMaintenanceCadence(["Post weekly"], []), true);
    assert.equal(hasMaintenanceCadence([], ["Refresh services"]), true);
  });
});
