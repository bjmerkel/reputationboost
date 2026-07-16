import type { GbpPlanStep } from "../types";

function stepHaystack(step: GbpPlanStep): string {
  return `${step.title} ${step.instruction}`.toLowerCase();
}

/** Plan step is about disputing illegitimate reviews. */
export function isReviewDisputePlanStep(step: GbpPlanStep): boolean {
  if (step.stepNumber === 9) return true;
  const haystack = stepHaystack(step);
  return /dispute|policy.violat|illegitimate review|flag review|report review/.test(haystack);
}

/** Plan step is about replying to existing reviews (not soliciting new ones). */
export function isReviewResponsePlanStep(step: GbpPlanStep): boolean {
  if (step.stepNumber === 11) return true;

  const haystack = stepHaystack(step);
  if (/review request|ask for reviews?|get more reviews|collect reviews?|solicit reviews?/.test(haystack)) {
    return false;
  }

  return /review response|respond to reviews?|unresponded reviews?|reply to reviews?|response rate|negative reviews?/.test(
    haystack
  );
}

/** Plan step is about requesting new reviews from customers. */
export function isReviewRequestPlanStep(step: GbpPlanStep): boolean {
  if (step.stepNumber === 10) return true;
  const haystack = stepHaystack(step);
  return /review request|ask for reviews?|get more reviews|collect reviews?|solicit reviews?|review campaign/.test(
    haystack
  );
}
