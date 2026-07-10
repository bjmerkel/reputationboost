import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask } from "../types";
import {
  filterMissingTasks,
  findActiveTaskByIdentity,
  isActiveReconcileTask,
  isMutableByReconcile,
  isTerminalTaskStatus,
  taskIdentityKey,
} from "./task-identity";

function task(overrides: Partial<ExecutionTask> = {}): ExecutionTask {
  return {
    id: "task-1",
    auditId: "2026-07-10",
    actionItemId: "gbp-step-3",
    type: "gbp_description",
    title: "Step 3: Description",
    description: "",
    priority: "P1",
    status: "pending_approval",
    draftContent: "Draft",
    payload: { gbpStepNumber: 3 },
    requiresApproval: true,
    scheduledFor: null,
    completedAt: null,
    result: null,
    createdAt: "2026-07-10T00:00:00.000Z",
    planStepNumber: 3,
    ...overrides,
  };
}

describe("taskIdentityKey", () => {
  it("keys Google suggestion tasks by type + suggestionField", () => {
    const accept = task({
      type: "gbp_accept_suggestion",
      actionItemId: "gbp-step-0",
      planStepNumber: 0,
      payload: { gbpStepNumber: 0, suggestionField: "title" },
    });
    const reject = task({
      ...accept,
      type: "gbp_reject_suggestion",
    });
    assert.equal(taskIdentityKey(accept), "gbp_accept_suggestion|field:title");
    assert.equal(taskIdentityKey(reject), "gbp_reject_suggestion|field:title");
    assert.notEqual(taskIdentityKey(accept), taskIdentityKey(reject));
  });

  it("keys NAP sync tasks by napField", () => {
    const phone = task({
      type: "gbp_phone",
      actionItemId: "gbp-step-0",
      planStepNumber: 0,
      payload: { gbpStepNumber: 0, napField: "phone", syncNap: true },
    });
    assert.equal(taskIdentityKey(phone), "gbp_phone|nap:phone");
  });

  it("keys media maintenance by mediaName", () => {
    const del = task({
      type: "gbp_media_delete",
      payload: { mediaName: "accounts/x/locations/y/media/z" },
    });
    assert.equal(
      taskIdentityKey(del),
      "gbp_media_delete|media:accounts/x/locations/y/media/z"
    );
  });

  it("keys photos by category and videos by normalized title", () => {
    const photo = task({
      type: "gbp_photo",
      payload: { category: "ADDITIONAL", gbpStepNumber: 6 },
      planStepNumber: 6,
    });
    const videoA = task({
      type: "gbp_video",
      title: "Step 7: Shop tour",
      planStepNumber: 7,
      payload: { gbpStepNumber: 7 },
    });
    const videoB = task({
      type: "gbp_video",
      title: "Shop tour",
      planStepNumber: 7,
      payload: { gbpStepNumber: 7 },
    });
    assert.equal(taskIdentityKey(photo), "gbp_photo|category:ADDITIONAL");
    assert.equal(taskIdentityKey(videoA), taskIdentityKey(videoB));
  });

  it("keys review tasks by reviewId", () => {
    const response = task({
      type: "review_response",
      payload: { reviewId: "reviews/abc", gbpStepNumber: 11 },
      planStepNumber: 11,
    });
    assert.equal(taskIdentityKey(response), "review_response|review:reviews/abc");
  });

  it("keys hours tasks by hoursAction (+ holiday year)", () => {
    const regular = task({
      type: "gbp_hours",
      planStepNumber: 12,
      payload: { gbpStepNumber: 12, hoursAction: "update_regular_hours" },
    });
    const holiday = task({
      type: "gbp_hours",
      planStepNumber: 12,
      payload: {
        gbpStepNumber: 12,
        hoursAction: "update_holiday_hours",
        holidayYear: 2026,
      },
    });
    assert.equal(taskIdentityKey(regular), "gbp_hours|hours:update_regular_hours");
    assert.equal(
      taskIdentityKey(holiday),
      "gbp_hours|hours:update_holiday_hours|year:2026"
    );
  });

  it("keys plan-step profile edits by type + step", () => {
    const description = task();
    assert.equal(taskIdentityKey(description), "gbp_description|step:3");
  });

  it("keys keyword portfolio as a singleton step task", () => {
    const portfolio = task({
      type: "update_tracked_keywords",
      actionItemId: "gbp-step-17",
      planStepNumber: 17,
      payload: { gbpStepNumber: 17, applyRecommendations: true },
    });
    assert.equal(taskIdentityKey(portfolio), "update_tracked_keywords|step:17");
  });

  it("ignores draft content and status when computing identity", () => {
    const a = task({ draftContent: "A", status: "pending_approval" });
    const b = task({
      id: "other",
      draftContent: "B",
      status: "approved",
    });
    assert.equal(taskIdentityKey(a), taskIdentityKey(b));
  });
});

describe("reconcile status helpers", () => {
  it("treats completed/rejected as terminal and not mutable", () => {
    assert.equal(isTerminalTaskStatus("completed"), true);
    assert.equal(isTerminalTaskStatus("rejected"), true);
    assert.equal(isMutableByReconcile(task({ status: "pending_approval" })), true);
    assert.equal(isMutableByReconcile(task({ status: "failed" })), true);
    assert.equal(isMutableByReconcile(task({ status: "approved" })), false);
    assert.equal(isMutableByReconcile(task({ status: "scheduled" })), false);
    assert.equal(isMutableByReconcile(task({ status: "completed" })), false);
  });

  it("treats pending/approved/scheduled/failed as active for dedupe", () => {
    assert.equal(isActiveReconcileTask(task({ status: "pending_approval" })), true);
    assert.equal(isActiveReconcileTask(task({ status: "approved" })), true);
    assert.equal(isActiveReconcileTask(task({ status: "scheduled" })), true);
    assert.equal(isActiveReconcileTask(task({ status: "failed" })), true);
    assert.equal(isActiveReconcileTask(task({ status: "completed" })), false);
    assert.equal(isActiveReconcileTask(task({ status: "rejected" })), false);
  });
});

describe("filterMissingTasks", () => {
  it("filters candidates that already have an active identity match", () => {
    const existing = [
      task({
        id: "existing-accept",
        type: "gbp_accept_suggestion",
        status: "pending_approval",
        payload: { suggestionField: "title" },
      }),
    ];
    const candidates = [
      task({
        id: "new-accept",
        type: "gbp_accept_suggestion",
        payload: { suggestionField: "title" },
      }),
      task({
        id: "new-reject",
        type: "gbp_reject_suggestion",
        payload: { suggestionField: "title" },
      }),
      task({
        id: "new-phone",
        type: "gbp_accept_suggestion",
        payload: { suggestionField: "phone" },
      }),
    ];

    const missing = filterMissingTasks(candidates, existing);
    assert.deepEqual(
      missing.map((item) => item.id),
      ["new-reject", "new-phone"]
    );
  });

  it("allows recreating a task after the previous one completed", () => {
    const existing = [
      task({
        id: "done",
        type: "gbp_photo",
        status: "completed",
        payload: { category: "ADDITIONAL" },
      }),
    ];
    const candidates = [
      task({
        id: "again",
        type: "gbp_photo",
        payload: { category: "ADDITIONAL" },
      }),
    ];
    assert.equal(filterMissingTasks(candidates, existing).length, 1);
  });

  it("findActiveTaskByIdentity returns the open match", () => {
    const existing = [
      task({
        id: "open",
        type: "update_tracked_keywords",
        planStepNumber: 17,
        payload: { gbpStepNumber: 17 },
        status: "pending_approval",
      }),
    ];
    const found = findActiveTaskByIdentity(
      existing,
      taskIdentityKey(existing[0])
    );
    assert.equal(found?.id, "open");
    assert.equal(
      findActiveTaskByIdentity(existing, "update_tracked_keywords|step:99"),
      undefined
    );
  });
});
