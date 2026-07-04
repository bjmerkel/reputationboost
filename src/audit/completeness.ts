/** Shared GBP completeness scoring used by collectors and counterfactuals. */

export interface GbpCompletenessInput {
  hasHours: boolean;
  hasFullWeekHours: boolean;
  hasHolidayHours: boolean;
  hasDescription: boolean;
  descriptionLength: number;
  hasServices: boolean;
  serviceCount: number;
  attributeCount: number;
  hasPhotos: boolean;
  hasWebsite: boolean;
  noPendingEdits: boolean;
}

export function computeGbpCompletenessScore(input: GbpCompletenessInput): number {
  const checks = [
    input.hasHours,
    input.hasFullWeekHours,
    input.hasHolidayHours,
    input.hasDescription,
    input.descriptionLength >= 400,
    input.hasServices,
    input.serviceCount >= 3,
    input.attributeCount >= 5,
    input.hasPhotos,
    input.hasWebsite,
    input.noPendingEdits,
  ];

  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

export function completenessChecksFromInput(
  input: GbpCompletenessInput
): boolean[] {
  return [
    input.hasHours,
    input.hasFullWeekHours,
    input.hasHolidayHours,
    input.hasDescription,
    input.descriptionLength >= 400,
    input.hasServices,
    input.serviceCount >= 3,
    input.attributeCount >= 5,
    input.hasPhotos,
    input.hasWebsite,
    input.noPendingEdits,
  ];
}
