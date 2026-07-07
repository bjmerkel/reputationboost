import type { GbpLocationInventory } from "@/audit/types";

export const GOOGLE_UPDATES_STEP_NUMBER = 0;

export interface FieldPlanStepLink {
  planStepNumber: number;
  alternateStepNumber?: number;
}

/** Maps inventory apiPath values to GBP plan step numbers (no execution-task logic). */
export const FIELD_PLAN_STEP_MAP: Record<string, FieldPlanStepLink> = {
  title: { planStepNumber: GOOGLE_UPDATES_STEP_NUMBER },
  "phoneNumbers.primaryPhone": { planStepNumber: GOOGLE_UPDATES_STEP_NUMBER },
  "phoneNumbers.additionalPhones": { planStepNumber: GOOGLE_UPDATES_STEP_NUMBER },
  storefrontAddress: { planStepNumber: GOOGLE_UPDATES_STEP_NUMBER },
  websiteUri: { planStepNumber: GOOGLE_UPDATES_STEP_NUMBER },
  "categories.primaryCategory": { planStepNumber: 1 },
  "categories.additionalCategories": { planStepNumber: 2 },
  "profile.description": { planStepNumber: 3 },
  serviceItems: { planStepNumber: 4 },
  regularHours: { planStepNumber: 12 },
  specialHours: { planStepNumber: 12 },
  moreHours: { planStepNumber: 12 },
  attributes: { planStepNumber: 13 },
  "content.photos": { planStepNumber: 6 },
  "content.posts": { planStepNumber: 8 },
  "content.qa": { planStepNumber: 9 },
  "engagement.reviews": { planStepNumber: 11, alternateStepNumber: 10 },
  "metadata.hasGoogleUpdated": { planStepNumber: GOOGLE_UPDATES_STEP_NUMBER },
  "metadata.hasPendingEdits": { planStepNumber: GOOGLE_UPDATES_STEP_NUMBER },
};

export function planLinkStepForApiPath(apiPath: string): FieldPlanStepLink | undefined {
  return FIELD_PLAN_STEP_MAP[apiPath];
}

/** Plan steps that should stay visible when linked inventory fields still need work. */
export function planStepsRequiredByInventory(
  inventory: GbpLocationInventory
): Set<number> {
  const required = new Set<number>();

  for (const field of inventory.fields) {
    if (field.status === "good" && !field.hasConflict) continue;

    const link = planLinkStepForApiPath(field.apiPath);
    if (!link) continue;

    required.add(link.planStepNumber);
    if (link.alternateStepNumber != null) {
      required.add(link.alternateStepNumber);
    }
  }

  return required;
}
