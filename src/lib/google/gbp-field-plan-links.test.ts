import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask, GbpLocationInventory } from "@/audit/types";
import {
  enrichInventoryWithPlanLinks,
  planLinkForApiPath,
  planScrollElementId,
} from "./gbp-field-plan-links";

const baseInventory: GbpLocationInventory = {
  collectedAt: "2026-07-06T12:00:00.000Z",
  source: "oauth",
  fields: [
    {
      apiPath: "profile.description",
      label: "Business description",
      section: "profile",
      current: "Short",
      status: "needs_work",
      editable: true,
    },
    {
      apiPath: "engagement.reviews",
      label: "Reviews",
      section: "engagement",
      current: "45 reviews",
      status: "needs_work",
      editable: true,
    },
    {
      apiPath: "metadata.hasGoogleUpdated",
      label: "Google suggestions",
      section: "status",
      current: "Pending",
      status: "conflict",
      editable: false,
      hasConflict: true,
    },
  ],
  summary: {
    total: 3,
    good: 0,
    needsWork: 2,
    missing: 0,
    conflict: 1,
    processing: 0,
    blocked: 0,
  },
};

function task(
  partial: Pick<ExecutionTask, "id" | "type" | "status" | "planStepNumber">
): ExecutionTask {
  return {
    id: partial.id,
    auditId: "audit-1",
    actionItemId: `gbp-step-${partial.planStepNumber}`,
    type: partial.type,
    title: "Task",
    description: "",
    priority: "P1",
    status: partial.status,
    draftContent: "",
    payload: {},
    requiresApproval: true,
    scheduledFor: null,
    completedAt: null,
    result: null,
    createdAt: "2026-07-06T12:00:00.000Z",
    planStepNumber: partial.planStepNumber,
  };
}

describe("gbp-field-plan-links", () => {
  it("maps known api paths to plan steps", () => {
    assert.equal(planLinkForApiPath("profile.description")?.planStepNumber, 3);
    assert.equal(planLinkForApiPath("content.photos")?.planStepNumber, 6);
  });

  it("enriches fields with matching plan tasks", () => {
    const enriched = enrichInventoryWithPlanLinks(baseInventory, [
      task({
        id: "desc-task",
        type: "gbp_description",
        status: "pending_approval",
        planStepNumber: 3,
      }),
      task({
        id: "review-task",
        type: "review_response",
        status: "pending_approval",
        planStepNumber: 11,
      }),
    ]);

    const description = enriched.fields.find((f) => f.apiPath === "profile.description");
    assert.equal(description?.planStepNumber, 3);
    assert.equal(description?.planTaskId, "desc-task");
    assert.equal(description?.planFixLabel, "Review fix");

    const reviews = enriched.fields.find((f) => f.apiPath === "engagement.reviews");
    assert.equal(reviews?.planStepNumber, 11);
  });

  it("routes conflict fields to google updates", () => {
    const enriched = enrichInventoryWithPlanLinks(baseInventory, [
      task({
        id: "accept-task",
        type: "gbp_accept_suggestion",
        status: "pending_approval",
        planStepNumber: 0,
      }),
    ]);

    const conflict = enriched.fields.find((f) => f.apiPath === "metadata.hasGoogleUpdated");
    assert.equal(conflict?.planStepNumber, 0);
    assert.equal(conflict?.planFixLabel, "Resolve conflict");
    assert.equal(conflict?.planScrollTarget, "google-updates");
  });

  it("builds scroll element ids", () => {
    assert.equal(planScrollElementId(3), "plan-step-3");
    assert.equal(planScrollElementId(0, "google-updates"), "google-updates-panel");
  });
});
