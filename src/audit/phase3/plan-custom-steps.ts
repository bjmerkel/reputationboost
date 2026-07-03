/** First step number reserved for LLM custom GBP actions (see gbp-plan-merge). */
export const CUSTOM_PLAN_STEP_START = 17;

export function isCustomPlanStep(stepNumber: number): boolean {
  return stepNumber >= CUSTOM_PLAN_STEP_START;
}

export function customPlanStepActionItemId(stepNumber: number): string {
  return `gbp-step-${stepNumber}`;
}
