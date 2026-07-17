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
import { buildTemplateGbpPlan } from "@/audit/phase2/gbp-plan";

describe("plan-custom-steps", () => {
  it("identifies step numbers 18+ as custom", () => {
    assert.equal(CUSTOM_PLAN_STEP_START, 18);
    assert.equal(isCustomPlanStep(16), false);
    assert.equal(isCustomPlanStep(17), false);
    assert.equal(isCustomPlanStep(18), true);
    assert.equal(customPlanStepActionItemId(18), "gbp-step-18");
  });
});

describe("tasksFromGbpPlanStep custom actions", () => {
  const audit = createTestAudit();
  const content = buildTemplateContent(audit);

  function customStep(overrides: Partial<GbpPlanStep> = {}): GbpPlanStep {
    return {
      stepNumber: 18,
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
    assert.equal(task.actionItemId, "gbp-step-18");
    assert.equal(task.planStepNumber, 18);
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
        stepNumber: 18,
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
    assert.ok(tasks.every((t) => t.planStepNumber === 18));
    assert.ok(tasks.some((t) => t.title.includes("Jane")));
    assert.ok(tasks.some((t) => t.title.includes("Bob")));
    assert.ok(tasks.every((t) => t.type !== "gbp_photo"));
  });

  it("supports multiple custom steps with distinct action item ids", () => {
    const step19 = customStep({
      stepNumber: 19,
      title: "Service area map",
      instruction: "Add a service area map to the profile.\n\nWhy this step: Reinforces geo coverage.",
    });

    const tasks18 = tasksFromGbpPlanStep(audit, customStep(), content);
    const tasks19 = tasksFromGbpPlanStep(audit, step19, content);

    assert.equal(resolvePlanStepNumber(tasks18[0]), 18);
    assert.equal(resolvePlanStepNumber(tasks19[0]), 19);
    assert.equal(tasks18[0].actionItemId, "gbp-step-18");
    assert.equal(tasks19[0].actionItemId, "gbp-step-19");
  });
});

describe("tasksFromGbpPlanStep step 5 services", () => {
  const audit = createTestAudit();
  const content = buildTemplateContent(audit);

  it("creates gbp_services tasks that publish via the Services API", () => {
    const templateStep = buildTemplateGbpPlan(audit).steps.find((step) => step.stepNumber === 5);
    assert.ok(templateStep);
    assert.equal(templateStep.gbpAction, "add_service_items");

    const tasks = tasksFromGbpPlanStep(audit, templateStep, content);
    assert.ok(tasks.length > 0);
    assert.ok(tasks.every((task) => task.type === "gbp_services"));
    assert.ok(tasks.every((task) => typeof task.payload.serviceName === "string"));
    assert.ok(tasks.every((task) => task.payload.serviceName !== task.title));
  });

  it("parses legacy product description copy blocks into service tasks", () => {
    const tasks = tasksFromGbpPlanStep(
      audit,
      {
        stepNumber: 5,
        title: "Priority Keyword Services",
        instruction: "Add GBP services for priority keywords.",
        gbpAction: "add_service_items",
        copyBlocks: [
          {
            label: "Product Description for HVAC repair near Newark NJ",
            content: "Licensed HVAC repair for homes and businesses in Newark and nearby communities.",
          },
        ],
      },
      content
    );

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].type, "gbp_services");
    assert.match(String(tasks[0].payload.serviceName), /Hvac|Repair/i);
    assert.equal(tasks[0].draftContent, tasks[0].payload.serviceDescription);
  });
});

describe("tasksFromGbpPlanStep description", () => {
  it("prefers LLM gbpDescription over stuffed plan actionData", () => {
    const audit = createTestAudit();
    const stuffed =
      "Acme provides professional HVAC throughout town. We specialize in ac repair near me, furnace near me, heat pump near me. The team is known for clean vehicles, with a focus on punctual arrivals.";
    const llmDescription =
      "Acme Heating keeps local homes comfortable year-round with careful diagnostics, clear pricing, and lasting repairs neighbors recommend.";

    const tasks = tasksFromGbpPlanStep(
      audit,
      {
        stepNumber: 3,
        title: "Rewrite the Business Description",
        instruction: "Update the description.",
        gbpAction: "update_description",
        copyBlocks: [{ label: "Recommended description (paste into GBP)", content: stuffed }],
        actionData: { description: stuffed },
      },
      {
        ...buildTemplateContent(audit),
        gbpDescription: llmDescription,
        contentSource: "llm",
      }
    );

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.type, "gbp_description");
    assert.equal(tasks[0]?.draftContent, llmDescription);
  });
});
