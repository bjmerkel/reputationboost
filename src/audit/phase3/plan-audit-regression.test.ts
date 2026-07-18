/**
 * Locks in automated coverage for the plan-tab audit findings (Phases 1–4).
 * See plan-proof-pack.ts for broader Definition of 9.0 criteria.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolveAttributionWindowDays } from "@/audit/attribution/window";
import { buildTemplateGbpPlan } from "@/audit/phase2/gbp-plan";
import { buildKeywordPlaybooks } from "@/audit/phase2/keyword-action-binding";
import { buildPlan } from "@/audit/phase3/build-plan";
import { deriveStepStatus } from "@/audit/phase3/plan-step-status";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import type { ExecutionTask, PlanStep } from "@/audit/types";
import { countGoogleConflictTasks } from "@/components/plan/GoogleUpdatesPanel";
import { hasMaintenanceCadence } from "@/components/plan/PlanMaintenanceCadence";
import {
  filterVisiblePlanSteps,
  planRefreshButtonLabel,
} from "@/components/plan/plan-display";
import {
  planGbpBannerMessage,
  reconcileFeedbackMessage,
} from "@/components/plan/plan-ux-copy";
import { formatAttributionTrackingLabel } from "@/lib/attribution/tracking-label";

function stubTask(status: ExecutionTask["status"]): ExecutionTask {
  return {
    id: `task-${status}`,
    type: "review_response",
    title: "Respond",
    draftContent: "Thanks!",
    payload: {},
    status,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function stubStep(
  overrides: Partial<PlanStep> & Pick<PlanStep, "stepNumber" | "title">
): PlanStep {
  return {
    phaseId: "reputation",
    instruction: "Reply to reviews",
    context: {
      targetKeywords: ["plumber"],
      expectedEffect: "Build trust",
    },
    tasks: [],
    status: "pending",
    ...overrides,
  };
}

describe("plan audit regression pack", () => {
  it("High — playbooks format leads as leads/mo without ACV", () => {
    const audit = createTestAudit();
    const plan = buildPlan(audit, audit.execution!.tasks);
    assert.ok(plan);
    const playbooks = buildKeywordPlaybooks(audit, plan!, { limit: 3 });
    for (const playbook of playbooks) {
      const label = playbook.actionExpectedImpactLabel ?? "";
      if (label.includes("leads/mo")) {
        assert.doesNotMatch(label, /\$\d/);
      }
    }
  });

  it("High — one rejected task does not skip a multi-task step", () => {
    assert.equal(
      deriveStepStatus([stubTask("rejected"), stubTask("pending_approval")]),
      "needs_approval"
    );
    const audit = createTestAudit();
    const base = audit.execution!.tasks[0];
    const plan = buildPlan(audit, [
      {
        ...base,
        id: "r1",
        planStepNumber: 11,
        actionItemId: "r1",
        type: "review_response",
        status: "rejected",
      },
      {
        ...base,
        id: "r2",
        planStepNumber: 11,
        actionItemId: "r2",
        type: "review_response",
        status: "pending_approval",
      },
    ]);
    const step = plan!.steps.find((item) => item.stepNumber === 11);
    assert.equal(step?.status, "needs_approval");
    assert.ok(filterVisiblePlanSteps(plan!.steps).some((item) => item.stepNumber === 11));
  });

  it("High — reconcile copy does not claim a live Google sync", () => {
    assert.doesNotMatch(reconcileFeedbackMessage({ completedTasks: 1, createdTasks: 0 }), /Google/i);
    assert.equal(planRefreshButtonLabel(false), "Refresh plan");
    const banner = planGbpBannerMessage(
      {
        title: "Plan",
        businessName: "Test",
        objective: "Win",
        targetKeywords: [],
        phases: [],
        progress: {
          totalSteps: 1,
          completedSteps: 0,
          needsApproval: 0,
          currentHealthScore: 50,
          projectedHealthScore: 60,
        },
        steps: [
          stubStep({
            stepNumber: 12,
            title: "Hours",
            tasks: [],
          }),
        ],
      },
      true
    );
    assert.match(banner ?? "", /refresh your plan/i);
    assert.doesNotMatch(banner ?? "", /Sync with Google/i);
  });

  it("Medium — Google conflict tasks are counted once for panel CTA routing", () => {
    const tasks = [
      { type: "gbp_accept_suggestion" },
      { type: "gbp_reject_suggestion" },
      { type: "gbp_description" },
    ] as ExecutionTask[];
    assert.equal(countGoogleConflictTasks(tasks), 2);
    const panelSource = readFileSync(
      new URL("../../components/plan/GoogleUpdatesPanel.tsx", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(panelSource, /PlanStepTaskRow/);
  });

  it("Medium — template plan avoids overstated ranking causality", () => {
    const plan = buildTemplateGbpPlan(createTestAudit());
    const copy = plan.steps.map((step) => step.instruction).join("\n");
    assert.doesNotMatch(copy, /strongest ranking signal/i);
    assert.doesNotMatch(copy, /every target keyword/i);
    assert.ok(hasMaintenanceCadence(plan.weeklyCadence, plan.monthlyCadence));
  });

  it("Medium — engagement tasks use a shorter attribution window", () => {
    assert.equal(resolveAttributionWindowDays("review_response"), 7);
    assert.equal(resolveAttributionWindowDays("gbp_description"), 14);
  });

  it("Medium — preliminary attribution shows measuring copy with days remaining", () => {
    const now = new Date("2026-07-04T00:00:00.000Z");
    const label = formatAttributionTrackingLabel(
      {
        preliminary: true,
        publishedAt: "2026-07-01T00:00:00.000Z",
        windowDays: 7,
        callsDelta: null,
        directionsDelta: null,
        websiteClicksDelta: null,
        impressionsDelta: null,
        rankDelta: null,
        observedDriverImpact: null,
        keywordsImproved: 0,
      },
      now
    );
    assert.match(label ?? "", /Measuring · 4 days left/);
  });
});
