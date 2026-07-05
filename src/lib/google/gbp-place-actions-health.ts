import type { GbpPlaceActionCoverage } from "@/audit/types";
import { placeActionTypeLabel } from "./gbp-place-actions";

export interface PlaceActionTypeStatus {
  type: string;
  label: string;
  configured: boolean;
  recommended: boolean;
}

export interface PlaceActionsHealthReport {
  overallScore: number;
  apiAvailable: boolean;
  partialApi: boolean;
  linkCount: number;
  merchantLinkCount: number;
  typeStatus: PlaceActionTypeStatus[];
  recommendations: string[];
}

/** Summarize place action health for dashboard display. */
export function buildPlaceActionsHealthReport(
  coverage: GbpPlaceActionCoverage
): PlaceActionsHealthReport {
  const recommended = new Set(coverage.missingRecommendedTypes);
  const allTypes = [...new Set([...coverage.availableTypes, ...coverage.configuredTypes])];

  const typeStatus: PlaceActionTypeStatus[] = allTypes.slice(0, 8).map((type) => ({
    type,
    label: placeActionTypeLabel(type),
    configured: coverage.configuredTypes.includes(type),
    recommended: recommended.has(type) || coverage.missingRecommendedTypes.includes(type),
  }));

  return {
    overallScore: coverage.coverageScore,
    apiAvailable: coverage.apiAvailable,
    partialApi: coverage.partialApi,
    linkCount: coverage.linkCount,
    merchantLinkCount: coverage.merchantLinkCount,
    typeStatus,
    recommendations: coverage.recommendations,
  };
}
