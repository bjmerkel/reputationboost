import { resultsScrollElementId } from "@/lib/google/gbp-field-plan-links";

/** Section anchor used when a step-specific Results row is missing. */
export const PLAN_CHANGELOG_SECTION_ID = "plan-changelog";

export type ResultsFocusResolution =
  | { kind: "hit"; elementId: string }
  | { kind: "miss"; sectionId: string; stepNumber: number };

/**
 * Resolve where a Plan→Results deep-link should land.
 * Always returns a target so callers can scroll and clear focus (no hang).
 */
export function resolveResultsFocus(
  focusStep: number,
  hasElement: (id: string) => boolean
): ResultsFocusResolution {
  const elementId = resultsScrollElementId(focusStep);
  if (hasElement(elementId)) {
    return { kind: "hit", elementId };
  }
  return {
    kind: "miss",
    sectionId: PLAN_CHANGELOG_SECTION_ID,
    stepNumber: focusStep,
  };
}

export function resultsFocusMissMessage(stepNumber: number): string {
  return `No measured results for step ${stepNumber} yet. Showing the plan changelog.`;
}

/** Session flag: Settings ACV save asks Plan to reconcile on next visit. */
export const PLAN_ACV_REFRESH_FLAG = "rb-refresh-plan-after-acv";

export function markPlanRefreshAfterAcvSave(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PLAN_ACV_REFRESH_FLAG, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function hasPlanRefreshAfterAcvSave(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PLAN_ACV_REFRESH_FLAG) === "1";
  } catch {
    return false;
  }
}

export function consumePlanRefreshAfterAcvSave(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(PLAN_ACV_REFRESH_FLAG) !== "1") return false;
    window.sessionStorage.removeItem(PLAN_ACV_REFRESH_FLAG);
    return true;
  } catch {
    return false;
  }
}
