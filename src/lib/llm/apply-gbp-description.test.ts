import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTemplateGbpPlan } from "@/audit/phase2/gbp-plan";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import type { AuditGeneratedContent } from "./content";
import {
  applyGeneratedDescriptionToAudit,
  resolveGbpDescriptionDraft,
  shouldApplyGeneratedDescription,
} from "./apply-gbp-description";

function llmContent(description: string): AuditGeneratedContent {
  return {
    googlePosts: ["a", "b", "c", "d"],
    gbpDescription: description,
    reviewResponses: [],
    reviewRequestSms: "sms",
    socialPost: "social",
    gbpPhotoJobs: [],
    contentSource: "llm",
  };
}

describe("apply-gbp-description", () => {
  it("prefers LLM content over stuffed plan copy when resolving drafts", () => {
    const audit = createTestAudit();
    const plan = buildTemplateGbpPlan(audit);
    const step = plan.steps.find((item) => item.stepNumber === 3)!;
    const stuffed =
      "Acme provides professional HVAC throughout town. We specialize in ac repair near me, furnace near me, heat pump near me.";
    const llm = llmContent(
      "Acme Heating & Cooling serves homeowners across town with careful diagnostics and lasting repairs. Neighbors trust the team for clear communication and quality workmanship."
    );

    const draft = resolveGbpDescriptionDraft(
      {
        ...step,
        copyBlocks: [{ label: "Recommended description", content: stuffed }],
        actionData: { description: stuffed },
      },
      llm,
      stuffed
    );

    assert.match(draft, /careful diagnostics/);
    assert.doesNotMatch(draft, /specialize in/);
  });

  it("applies LLM description onto plan step 3 for Plan UI copyBlocks", () => {
    const audit = createTestAudit();
    const llm = llmContent(
      "Wayne Refrigeration keeps Northern Virginia homes comfortable with skilled HVAC service and clear communication from start to finish."
    );

    const next = applyGeneratedDescriptionToAudit(audit, llm);
    const step = next.strategy.gbpPlan?.steps.find((item) => item.stepNumber === 3);

    assert.equal(step?.actionData?.description, llm.gbpDescription);
    assert.equal(step?.copyBlocks?.[0]?.content, llm.gbpDescription);
    assert.equal(shouldApplyGeneratedDescription("old stuffed we specialize in a, b, c", llm), true);
  });

  it("does not overwrite a strong plan description with template content", () => {
    const audit = createTestAudit();
    const strong =
      "Nestled in Las Vegas since 1997, Northshore Learning Center offers a safe and supportive environment where children from 6 weeks to 12 years can learn, play, and grow.";
    const stepIndex = audit.strategy.gbpPlan!.steps.findIndex((item) => item.stepNumber === 3);
    audit.strategy.gbpPlan!.steps[stepIndex] = {
      ...audit.strategy.gbpPlan!.steps[stepIndex]!,
      copyBlocks: [{ label: "Recommended description (paste into GBP)", content: strong }],
      actionData: { description: strong },
    };

    const template: AuditGeneratedContent = {
      ...llmContent("Template rewrite that should not win."),
      contentSource: "template",
    };

    const next = applyGeneratedDescriptionToAudit(audit, template);
    const step = next.strategy.gbpPlan?.steps.find((item) => item.stepNumber === 3);
    assert.equal(step?.actionData?.description, strong);
  });
});
