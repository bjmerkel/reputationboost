import type { GbpPlanActionType, GbpPlanStep } from "../types";

const AUTOMATED_ACTIONS = new Set<GbpPlanActionType>([
  "update_primary_category",
  "add_secondary_categories",
  "update_description",
  "add_service_items",
  "upload_photo",
  "upload_video",
  "update_attributes",
  "update_website",
  "create_post",
]);

const ACTION_BY_STEP: Partial<Record<number, GbpPlanActionType>> = {
  1: "update_primary_category",
  2: "add_secondary_categories",
  3: "update_description",
  4: "add_service_items",
  6: "upload_photo",
  7: "upload_video",
  8: "create_post",
  13: "update_attributes",
  15: "update_website",
};

/** LLM plans often set gbpAction to "manual" — fall back to template or step number. */
export function resolvePlanStepAction(
  step: GbpPlanStep,
  templateStep?: GbpPlanStep
): GbpPlanActionType | undefined {
  if (
    step.gbpAction &&
    step.gbpAction !== "manual" &&
    AUTOMATED_ACTIONS.has(step.gbpAction)
  ) {
    return step.gbpAction;
  }

  if (
    templateStep?.gbpAction &&
    templateStep.gbpAction !== "manual" &&
    AUTOMATED_ACTIONS.has(templateStep.gbpAction)
  ) {
    return templateStep.gbpAction;
  }

  return ACTION_BY_STEP[step.stepNumber] ?? step.gbpAction ?? templateStep?.gbpAction;
}
