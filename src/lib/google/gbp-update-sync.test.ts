import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask } from "@/audit/types";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  getGoogleDiffFields,
  getGooglePendingFields,
  hasUnresolvedGoogleDiffs,
  missingGoogleSuggestionTasks,
} from "./gbp-update-helpers";

function auditWithGoogleUpdate() {
  const audit = createTestAudit();
  return {
    ...audit,
    gbp: {
      ...audit.gbp,
      googleUpdateState: {
        diffMask: "profile.description",
        pendingMask: "",
        diffFields: [
          {
            field: "profile.description",
            label: "Description",
            ownerValue: "Our text",
            googleValue: "Google text",
            kind: "diff" as const,
          },
        ],
        pendingFields: [],
      },
      googleSuggestions: [
        {
          field: "profile.description",
          label: "Description",
          ownerValue: "Our text",
          googleValue: "Google text",
          kind: "diff" as const,
        },
      ],
    },
  };
}

function task(partial: Partial<ExecutionTask>): ExecutionTask {
  return {
    id: "task-1",
    auditId: "audit-1",
    actionItemId: "gbp-step-0",
    type: "gbp_accept_suggestion",
    title: "Accept",
    description: "",
    priority: "P1",
    status: "pending_approval",
    draftContent: "",
    payload: { suggestionField: "profile.description" },
    requiresApproval: true,
    scheduledFor: null,
    completedAt: null,
    result: null,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("gbp-update-sync", () => {
  it("reads diff and pending fields from audit state", () => {
    const payload = auditWithGoogleUpdate();
    assert.equal(getGoogleDiffFields(payload).length, 1);
    assert.equal(getGooglePendingFields(payload).length, 0);
    assert.equal(hasUnresolvedGoogleDiffs(payload), true);
  });

  it("creates missing accept and reject tasks per diff field", () => {
    const payload = auditWithGoogleUpdate();
    const missing = missingGoogleSuggestionTasks(payload, []);
    assert.equal(missing.length, 2);
    assert.ok(missing.some((t) => t.type === "gbp_accept_suggestion"));
    assert.ok(missing.some((t) => t.type === "gbp_reject_suggestion"));
  });

  it("skips tasks that already exist for the same field and type", () => {
    const payload = auditWithGoogleUpdate();
    const missing = missingGoogleSuggestionTasks(payload, [
      task({ type: "gbp_accept_suggestion" }),
    ]);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].type, "gbp_reject_suggestion");
  });
});
