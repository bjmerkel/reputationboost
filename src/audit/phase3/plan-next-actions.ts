import type { Plan, PlanStep } from "../types";
import type { AttributionCalibration } from "../phase2/attribution-calibration";
import type { ConversionChannelBias } from "../phase2/conversion-channel";
import { conversionLeversForChannel } from "../phase2/conversion-channel";
import { isConversionPlanStep } from "../phase2/conversion-constants";
import { planStepPriorityScore } from "../phase2/plan-prioritization";

const ACTIONABLE: ReadonlySet<PlanStep["status"]> = new Set([
  "pending",
  "needs_approval",
  "approved",
]);

export interface NextBestPlanStepsOptions {
  /**
   * When true (visible profile, weak conversion), overweight conversion-family
   * steps so NBA leads with place actions / CTA posts / replies / attributes.
   */
  preferConversionSteps?: boolean;
  /**
   * Mild boost (1.15×) for 40–99 view listings with conversion gaps — softer
   * than preferConversionSteps.
   */
  softConversionBoost?: boolean;
  /**
   * When true (mostly outside-pack + review-velocity gap), elevate review
   * request campaigns so step 10 can appear in the top 3.
   */
  reviewVelocityBoost?: boolean;
  calibration?: AttributionCalibration;
  preferredConversionChannel?: ConversionChannelBias;
  revenueContext?: import("../revenue-attribution/types").RevenueContext;
}

function stepRank(step: PlanStep): number {
  return step.displayOrder ?? step.stepNumber;
}

function scoreImpactTieBreak(step: PlanStep): number {
  return (
    (step.context.outcomeScoreImpact ?? 0) * 10 + (step.context.healthScoreImpact ?? 0)
  );
}

function conversionBoostForStep(
  step: PlanStep,
  preferConversionSteps: boolean,
  preferredConversionChannel?: ConversionChannelBias,
  softConversionBoost = false,
  reviewVelocityBoost = false
): number {
  if (softConversionBoost && isConversionPlanStep(step.stepNumber)) {
    return 1.15;
  }
  if (reviewVelocityBoost && step.stepNumber === 10) {
    return 2.5;
  }
  if (!preferConversionSteps) return 1;

  if (isConversionPlanStep(step.stepNumber)) {
    let boost = 1.35;
    if (preferredConversionChannel && preferredConversionChannel !== "balanced") {
      const levers = conversionLeversForChannel(preferredConversionChannel);
      const rank = levers.indexOf(step.stepNumber);
      if (rank >= 0) {
        boost += (levers.length - rank) * 0.08;
      }
    }
    return boost;
  }

  // Match gbp-plan: demote photo/video busywork when views don't convert.
  if (step.stepNumber === 6 || step.stepNumber === 7) {
    return 0.25;
  }

  return 1;
}

/** Top unfinished plan steps ordered by EV × confidence ÷ effort. */
export function selectNextBestPlanSteps(
  plan: Plan,
  limit = 3,
  options: NextBestPlanStepsOptions = {}
): PlanStep[] {
  const preferConversionSteps = options.preferConversionSteps === true;
  const softConversionBoost = options.softConversionBoost === true;
  const reviewVelocityBoost = options.reviewVelocityBoost === true;

  const actionable = plan.steps.filter(
    (step) =>
      ACTIONABLE.has(step.status) && step.stepNumber !== 0 /* google updates shown separately */
  );

  const sorted = [...actionable].sort((a, b) => {
    const priorityDiff =
      planStepPriorityScore(b, {
        calibration: options.calibration,
        revenueContext: options.revenueContext,
        conversionBoost: conversionBoostForStep(
          b,
          preferConversionSteps,
          options.preferredConversionChannel,
          softConversionBoost,
          reviewVelocityBoost
        ),
      }) -
      planStepPriorityScore(a, {
        calibration: options.calibration,
        revenueContext: options.revenueContext,
        conversionBoost: conversionBoostForStep(
          a,
          preferConversionSteps,
          options.preferredConversionChannel,
          softConversionBoost,
          reviewVelocityBoost
        ),
      });
    if (priorityDiff !== 0) return priorityDiff;

    const rankDiff = stepRank(a) - stepRank(b);
    if (rankDiff !== 0) return rankDiff;
    return scoreImpactTieBreak(b) - scoreImpactTieBreak(a);
  });

  const top = sorted.slice(0, limit);
  if (reviewVelocityBoost && !preferConversionSteps) {
    const step10 = sorted.find((step) => step.stepNumber === 10);
    if (step10 && !top.some((step) => step.stepNumber === 10)) {
      top[top.length - 1] = step10;
      top.sort(
        (a, b) =>
          planStepPriorityScore(b, {
            calibration: options.calibration,
            revenueContext: options.revenueContext,
            conversionBoost: conversionBoostForStep(
              b,
              preferConversionSteps,
              options.preferredConversionChannel,
              softConversionBoost,
              reviewVelocityBoost
            ),
          }) -
          planStepPriorityScore(a, {
            calibration: options.calibration,
            revenueContext: options.revenueContext,
            conversionBoost: conversionBoostForStep(
              a,
              preferConversionSteps,
              options.preferredConversionChannel,
              softConversionBoost,
              reviewVelocityBoost
            ),
          })
      );
    }
  }

  return top;
}
