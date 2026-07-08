import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask } from "@/audit/types";
import {
  getPendingApprovalCounts,
  planApprovalBadgeCount,
} from "./pending-counts";

function task(overrides: Partial<ExecutionTask> & { id: string }): ExecutionTask {
  return {
    auditId: "2026-07-03",
    actionItemId: "gbp-step-3",
    type: "gbp_description",
    title: "Description",
    description: "",
    priority: "P1",
    status: "pending_approval",
    draftContent: "draft",
    payload: { gbpStepNumber: 3 },
    requiresApproval: true,
    scheduledFor: null,
    completedAt: null,
    result: null,
    createdAt: "2026-07-03T00:00:00.000Z",
    planStepNumber: 3,
    ...overrides,
  };
}

describe("pending-counts", () => {
  it("separates batchable and generating photo tasks", () => {
    const counts = getPendingApprovalCounts([
      task({ id: "desc" }),
      task({ id: "post", type: "google_post" }),
      task({ id: "photo", type: "gbp_photo", payload: {} }),
      task({
        id: "photo-ready",
        type: "gbp_photo",
        payload: { previewDataUrl: "data:image/png;base64,abc" },
      }),
      task({ id: "reply", type: "review_response" }),
      task({ id: "done", status: "completed" }),
    ]);

    assert.equal(counts.total, 5);
    assert.equal(counts.batchable, 4);
    assert.equal(counts.generating, 1);
    assert.equal(counts.reviewReplies, 1);
  });

  it("uses batchable count for badge when items are ready", () => {
    const counts = getPendingApprovalCounts([
      task({ id: "a" }),
      task({ id: "photo", type: "gbp_photo", payload: {} }),
    ]);
    assert.equal(planApprovalBadgeCount([task({ id: "a" }), task({ id: "photo", type: "gbp_photo", payload: {} })]), 1);
    assert.equal(counts.batchable, 1);
    assert.equal(counts.generating, 1);
  });

  it("falls back to generating count when nothing is batchable yet", () => {
    assert.equal(
      planApprovalBadgeCount([
        task({ id: "photo", type: "gbp_photo", payload: {} }),
      ]),
      1
    );
  });
});
