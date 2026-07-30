import type { FullAuditPayload, Plan, PlanStep } from "@/audit/types";
import { auditNeedsReviewVelocityBoost } from "@/audit/phase2/conversion-boost";
import { PLAN_PHASE_DEFINITIONS } from "@/audit/phase3/plan-phases";
import { buildStepContext } from "@/audit/phase3/step-context";
import {
  isProfileGuideReviewReady,
  type ProfileGuideReadiness,
} from "./readiness";

/** Repurposes retired step 16 (legacy Continuous Activity) for Profile Guide publish. */
export const PROFILE_GUIDE_PLAN_STEP = 16;

const PROFILE_GUIDE_GBP_STEP = {
  stepNumber: PROFILE_GUIDE_PLAN_STEP,
  title: "Publish your Profile Guide",
  instruction:
    "Create a branded mobile page and QR code so customers can leave Google reviews, get directions, and contact you from one scan. Review requests and in-person asks convert better through Profile Guide than raw Google links.",
  current: "Profile Guide not published",
  recommended: "Published guide with Review button enabled and QR downloaded",
  bullets: [
    "Enable the Review action button on your guide",
    "Publish so SMS review requests use your branded link",
    "Download the QR code for your front desk, truck, or printed flyer",
  ],
  gbpAction: "manual" as const,
};

export function shouldIncludeProfileGuidePlanStep(
  audit: FullAuditPayload,
  plan: Plan
): boolean {
  const hasReviewStep = plan.steps.some((step) => step.stepNumber === 10);
  return hasReviewStep || auditNeedsReviewVelocityBoost(audit);
}

function stepDisplayRank(step: PlanStep): number {
  return step.displayOrder ?? step.stepNumber;
}

function filterPhasesWithSteps(steps: PlanStep[]) {
  const stepsByNumber = new Map(steps.map((step) => [step.stepNumber, step]));
  const stepNumbers = new Set(steps.map((step) => step.stepNumber));

  return PLAN_PHASE_DEFINITIONS.map((phase) => ({
    ...phase,
    stepNumbers: phase.stepNumbers
      .filter((stepNumber) => stepNumbers.has(stepNumber))
      .sort(
        (a, b) =>
          stepDisplayRank(stepsByNumber.get(a)!) - stepDisplayRank(stepsByNumber.get(b)!)
      ),
  })).filter((phase) => phase.stepNumbers.length > 0);
}

function buildProfileGuidePlanStep(
  audit: FullAuditPayload,
  plan: Plan,
  readiness: ProfileGuideReadiness
): PlanStep {
  const reviewStep = plan.steps.find((step) => step.stepNumber === 10);
  const context = buildStepContext(audit, PROFILE_GUIDE_GBP_STEP);
  const published = isProfileGuideReviewReady(readiness);

  return {
    stepNumber: PROFILE_GUIDE_PLAN_STEP,
    phaseId: "reputation",
    title: PROFILE_GUIDE_GBP_STEP.title,
    instruction: PROFILE_GUIDE_GBP_STEP.instruction,
    context: {
      ...context,
      currentValue: published ? "Profile Guide published" : "Profile Guide not published",
      recommendedValue: PROFILE_GUIDE_GBP_STEP.recommended,
      expectedEffect: published
        ? "Your Profile Guide is live — review requests and QR scans can be attributed to new Google reviews."
        : "Publishing unlocks branded review links for SMS outreach and measurable QR-to-review conversion.",
      healthScoreImpact: published ? 0 : 3,
      outcomeScoreImpact: published ? 0 : 2,
    },
    gbpAction: PROFILE_GUIDE_GBP_STEP.gbpAction,
    bullets: PROFILE_GUIDE_GBP_STEP.bullets,
    tasks: [],
    status: published ? "completed" : "pending",
    displayOrder:
      reviewStep != null
        ? Math.max(0, (reviewStep.displayOrder ?? reviewStep.stepNumber) - 1)
        : 9,
  };
}

export function mergeProfileGuideIntoPlan(
  plan: Plan,
  audit: FullAuditPayload,
  readiness: ProfileGuideReadiness
): Plan {
  if (!shouldIncludeProfileGuidePlanStep(audit, plan)) {
    return plan;
  }

  const published = isProfileGuideReviewReady(readiness);
  const withoutProfileGuide = plan.steps.filter(
    (step) => step.stepNumber !== PROFILE_GUIDE_PLAN_STEP
  );

  if (published) {
    if (withoutProfileGuide.length === plan.steps.length) {
      return plan;
    }

    const steps = withoutProfileGuide.sort(
      (a, b) => stepDisplayRank(a) - stepDisplayRank(b)
    );
    return {
      ...plan,
      steps,
      phases: filterPhasesWithSteps(steps),
      progress: {
        ...plan.progress,
        totalSteps: steps.length,
        completedSteps: steps.filter((step) => step.status === "completed").length,
      },
    };
  }

  const profileStep = buildProfileGuidePlanStep(audit, plan, readiness);
  const existingIndex = plan.steps.findIndex(
    (step) => step.stepNumber === PROFILE_GUIDE_PLAN_STEP
  );
  const steps =
    existingIndex >= 0
      ? plan.steps.map((step, index) => (index === existingIndex ? profileStep : step))
      : [...withoutProfileGuide, profileStep];

  steps.sort((a, b) => stepDisplayRank(a) - stepDisplayRank(b));

  return {
    ...plan,
    steps,
    phases: filterPhasesWithSteps(steps),
    progress: {
      ...plan.progress,
      totalSteps: steps.length,
      completedSteps: steps.filter((step) => step.status === "completed").length,
    },
  };
}
