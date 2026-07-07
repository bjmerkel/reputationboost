import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpPlanStep } from "../types";
import { buildTemplateContent } from "@/lib/llm/content";
import { createTestAudit } from "./test-fixtures";
import {
  CUSTOM_PLAN_STEP_START,
  customPlanStepActionItemId,
  isCustomPlanStep,
} from "./plan-custom-steps";
import { tasksFromGbpPlanStep } from "./gbp-plan-tasks";
import { resolvePlanStepNumber } from "./plan-task-utils";

describe("plan-custom-steps", () => {
  it("identifies step numbers 17+ as custom", () => {
    assert.equal(CUSTOM_PLAN_STEP_START, 17);
    assert.equal(isCustomPlanStep(16), false);
    assert.equal(isCustomPlanStep(17), true);
    assert.equal(isCustomPlanStep(18), true);
    assert.equal(customPlanStepActionItemId(17), "gbp-step-17");
  });
});

describe("tasksFromGbpPlanStep custom actions", () => {
  const audit = createTestAudit();
  const content = buildTemplateContent(audit);

  function customStep(overrides: Partial<GbpPlanStep> = {}): GbpPlanStep {
    return {
      stepNumber: 17,
      title: "Airport route video",
      instruction: "Upload a 45-second airport pickup video.\n\nWhy this step: Targets airport shuttle keyword gap.",
      gbpAction: "manual",
      ...overrides,
    };
  }

  it("creates checklist tasks with customAction flag for manual custom steps", () => {
    const tasks = tasksFromGbpPlanStep(audit, customStep(), content);

    assert.equal(tasks.length, 1);
    const task = tasks[0];
    assert.equal(task.type, "gbp_checklist");
    assert.equal(task.actionItemId, "gbp-step-17");
    assert.equal(task.planStepNumber, 17);
    assert.equal(task.planPhaseId, "ongoing");
    assert.equal(task.payload.customAction, true);
    assert.equal(task.payload.isCustomPlanStep, true);
    assert.equal(task.payload.manual, true);
    assert.ok(typeof task.payload.expectedEffect === "string");
    assert.equal(task.payload.projectedDriverImpact, undefined);
    assert.match(task.draftContent, /airport pickup video/i);
  });

  it("emits one task per copyBlock for custom steps", () => {
    const tasks = tasksFromGbpPlanStep(
      audit,
      customStep({
        copyBlocks: [
          { label: "Video script", content: "Open on the Dallas skyline, then show the shuttle fleet." },
          { label: "Upload checklist", content: "Export 1080p MP4, upload under Videos > At work." },
        ],
      }),
      content
    );

    assert.equal(tasks.length, 2);
    assert.ok(tasks.every((t) => t.payload.customAction === true));
    assert.ok(tasks.every((t) => t.payload.isCustomPlanStep === true));
    assert.equal(tasks[0].payload.checklistIndex, 1);
    assert.equal(tasks[1].payload.checklistIndex, 2);
    assert.match(tasks[0].title, /Video script/);
    assert.match(tasks[1].title, /Upload checklist/);
  });

  it("creates per-review response tasks for custom review-response steps", () => {
    const auditWithReviews = {
      ...audit,
      reviews: {
        ...audit.reviews,
        reviews: [
          {
            id: "rev-1",
            rating: 5,
            text: "Great CarPlay install!",
            author: "Jane Smith",
            publishedAt: "2026-06-01T00:00:00.000Z",
            responded: false,
            responseTimeHours: null,
            sentiment: "positive" as const,
          },
          {
            id: "rev-2",
            rating: 2,
            text: "Parking sensors were installed incorrectly.",
            author: "Bob Jones",
            publishedAt: "2026-06-15T00:00:00.000Z",
            responded: false,
            responseTimeHours: null,
            sentiment: "negative" as const,
          },
        ],
      },
    };

    const tasks = tasksFromGbpPlanStep(
      auditWithReviews,
      {
        stepNumber: 17,
        title: "Increase Review Response Rate",
        instruction:
          "Respond to all reviews, especially negative ones, within 24 hours to improve response rates and customer trust.\n\nWhy this step: Improving the review response rate is critical to enhancing customer trust and engagement.",
        gbpAction: "upload_photo",
      },
      content
    );

    assert.ok(tasks.length >= 2);
    assert.ok(tasks.every((t) => t.type === "review_response"));
    assert.ok(tasks.every((t) => t.payload.customAction === true));
    assert.ok(tasks.every((t) => t.payload.isCustomPlanStep === true));
    assert.ok(tasks.every((t) => t.planStepNumber === 17));
    assert.ok(tasks.some((t) => t.title.includes("Jane")));
    assert.ok(tasks.some((t) => t.title.includes("Bob")));
    assert.ok(tasks.every((t) => t.type !== "gbp_photo"));
  });

  it("supports multiple custom steps with distinct action item ids", () => {
    const step18 = customStep({
      stepNumber: 18,
      title: "Fleet branding photos",
      instruction: "Upload branded vehicle photos.\n\nWhy this step: Differentiator for branded searches.",
    });

    const tasks17 = tasksFromGbpPlanStep(audit, customStep(), content);
    const tasks18 = tasksFromGbpPlanStep(audit, step18, content);

    assert.equal(resolvePlanStepNumber(tasks17[0]), 17);
    assert.equal(resolvePlanStepNumber(tasks18[0]), 18);
    assert.equal(tasks17[0].actionItemId, "gbp-step-17");
    assert.equal(tasks18[0].actionItemId, "gbp-step-18");
  });
});
