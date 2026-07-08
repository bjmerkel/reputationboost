import type { Phase1AuditPayload } from "../types";
import { SEARCH_RADII_MILES, type SearchRadiusMiles } from "@/lib/google/places";

export type RadiusProfileKey = "hyperlocal" | "neighborhood" | "metro" | "equal";

export type RadiusWeights = Record<SearchRadiusMiles, number>;

/** Share of geo-grid vs multi-radius rings when both exist (0–1). */
export const GRID_RADIUS_BLEND = 0.5;

export const RADIUS_PROFILE_WEIGHTS: Record<RadiusProfileKey, RadiusWeights> = {
  hyperlocal: { 1: 0.45, 3: 0.3, 5: 0.15, 10: 0.1 },
  neighborhood: { 1: 0.2, 3: 0.35, 5: 0.3, 10: 0.15 },
  metro: { 1: 0.1, 3: 0.25, 5: 0.35, 10: 0.3 },
  equal: { 1: 0.25, 3: 0.25, 5: 0.25, 10: 0.25 },
};

const HYPERLOCAL_CATEGORY = [
  /restaurant/i,
  /cafe|café/i,
  /coffee/i,
  /bakery/i,
  /\bbar\b/i,
  /pizza/i,
  /retail/i,
  /\bstore\b/i,
  /grocery/i,
  /fast food/i,
];

const NEIGHBORHOOD_CATEGORY = [
  /preschool/i,
  /daycare|day care/i,
  /child care/i,
  /learning center/i,
  /nursery school/i,
  /kindergarten/i,
  /\bgym\b/i,
  /fitness/i,
  /salon/i,
  /spa\b/i,
  /dentist/i,
  /dental/i,
  /veterinar/i,
  /yoga/i,
];

const METRO_CATEGORY = [
  /plumb/i,
  /hvac/i,
  /electric/i,
  /tutor/i,
  /contractor/i,
  /repair/i,
  /cleaning/i,
  /landscap/i,
  /roof/i,
  /auto repair/i,
  /moving/i,
  /pest control/i,
  /locksmith/i,
];

function isServiceAreaBusiness(audit: Phase1AuditPayload): boolean {
  const serviceAreaField = audit.gbp.locationInventory?.fields.find(
    (field) => field.section === "service_area"
  );
  return Boolean(serviceAreaField && serviceAreaField.status !== "missing");
}

function categoryMatches(patterns: RegExp[], category: string): boolean {
  return patterns.some((pattern) => pattern.test(category));
}

/** Pick radius weights from GBP category and service-area business type. */
export function resolveRadiusProfile(audit: Phase1AuditPayload): RadiusProfileKey {
  const category = audit.gbp.identity.primaryCategory ?? "";

  if (isServiceAreaBusiness(audit)) {
    if (categoryMatches(NEIGHBORHOOD_CATEGORY, category)) return "neighborhood";
    return "metro";
  }

  if (categoryMatches(HYPERLOCAL_CATEGORY, category)) return "hyperlocal";
  if (categoryMatches(NEIGHBORHOOD_CATEGORY, category)) return "neighborhood";
  if (categoryMatches(METRO_CATEGORY, category)) return "metro";

  return "neighborhood";
}

export function radiusWeightsForAudit(audit: Phase1AuditPayload): RadiusWeights {
  return { ...RADIUS_PROFILE_WEIGHTS[resolveRadiusProfile(audit)] };
}

export function radiusProfileLabel(profile: RadiusProfileKey): string {
  switch (profile) {
    case "hyperlocal":
      return "Mostly local (1–3 mi)";
    case "neighborhood":
      return "Neighborhood draw (3–5 mi)";
    case "metro":
      return "Metro service area (5–10 mi)";
    case "equal":
      return "Balanced across radii";
  }
}

export function formatRadiusMiles(miles: SearchRadiusMiles): string {
  return miles === 1 ? "1 mi" : `${miles} mi`;
}

export function availableSearchRadii(weights: RadiusWeights): SearchRadiusMiles[] {
  return SEARCH_RADII_MILES.filter((miles) => weights[miles] > 0);
}
