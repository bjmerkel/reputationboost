import type { GbpPlaceActionLink, GbpPlaceActionType, GbpPlaceActionTypeMetadata } from "./gbp-place-actions";
import { placeActionTypeLabel } from "./gbp-place-actions";

export interface GbpPlaceActionCoverage {
  apiAvailable: boolean;
  partialApi: boolean;
  coverageScore: number;
  linkCount: number;
  merchantLinkCount: number;
  configuredTypes: string[];
  availableTypes: string[];
  missingRecommendedTypes: string[];
  hasAppointmentLink: boolean;
  hasOnlineAppointmentLink: boolean;
  hasDiningReservationLink: boolean;
  hasFoodOrderingLink: boolean;
  hasShopOnlineLink: boolean;
  endpoints: {
    links: string;
    typeMetadata: string;
  };
  recommendations: string[];
}

const FOOD_CATEGORY_HINTS = [
  "restaurant",
  "food",
  "cafe",
  "bar",
  "bakery",
  "catering",
  "pizza",
  "dining",
];

const SERVICE_CATEGORY_HINTS = [
  "salon",
  "spa",
  "clinic",
  "dentist",
  "doctor",
  "lawyer",
  "plumber",
  "contractor",
  "repair",
  "service",
  "agency",
  "consult",
];

const RETAIL_CATEGORY_HINTS = ["store", "shop", "retail", "boutique", "market"];

function endpointLabel(status?: string): string {
  return status ?? "skipped";
}

function uniqueConfiguredTypes(links: GbpPlaceActionLink[]): string[] {
  return [...new Set(links.filter((link) => link.uri).map((link) => link.placeActionType))];
}

function recommendedTypesForCategory(primaryCategory?: string): GbpPlaceActionType[] {
  const category = (primaryCategory ?? "").toLowerCase();
  if (FOOD_CATEGORY_HINTS.some((hint) => category.includes(hint))) {
    return ["DINING_RESERVATION", "FOOD_ORDERING", "FOOD_DELIVERY"];
  }
  if (RETAIL_CATEGORY_HINTS.some((hint) => category.includes(hint))) {
    return ["SHOP_ONLINE"];
  }
  if (SERVICE_CATEGORY_HINTS.some((hint) => category.includes(hint))) {
    return ["APPOINTMENT", "ONLINE_APPOINTMENT"];
  }
  return ["APPOINTMENT", "SHOP_ONLINE"];
}

function hasType(links: GbpPlaceActionLink[], type: GbpPlaceActionType): boolean {
  return links.some((link) => link.placeActionType === type && Boolean(link.uri));
}

/** Score how fully place action links are configured for a location. */
export function analyzeGbpPlaceActionCoverage(input: {
  links: GbpPlaceActionLink[];
  availableTypes: GbpPlaceActionTypeMetadata[];
  primaryCategory?: string;
  probe?: {
    endpoints?: { links?: string; typeMetadata?: string };
    partial?: boolean;
  };
}): GbpPlaceActionCoverage {
  const configuredTypes = uniqueConfiguredTypes(input.links);
  const availableTypes = input.availableTypes.map((item) => item.placeActionType);
  const availableSet = new Set(availableTypes);

  const recommended = recommendedTypesForCategory(input.primaryCategory).filter((type) =>
    availableSet.has(type)
  );
  const missingRecommendedTypes = recommended.filter((type) => !configuredTypes.includes(type));

  const merchantLinkCount = input.links.filter(
    (link) => link.providerType !== "AGGREGATOR_3P" && Boolean(link.uri)
  ).length;

  const apiAvailable =
    input.probe?.endpoints?.links === "ok" ||
    input.probe?.endpoints?.typeMetadata === "ok" ||
    input.links.length > 0 ||
    input.availableTypes.length > 0;

  let coverageScore = 0;
  if (apiAvailable) coverageScore += 30;
  if (configuredTypes.length > 0) coverageScore += 35;
  if (recommended.length > 0) {
    const configuredRecommended = recommended.length - missingRecommendedTypes.length;
    coverageScore += Math.round((configuredRecommended / recommended.length) * 35);
  } else if (configuredTypes.length > 0) {
    coverageScore += 35;
  }

  const recommendations: string[] = [];
  if (!apiAvailable) {
    recommendations.push("Reconnect GBP with a manager account that has Place Actions API access.");
  } else {
    if (missingRecommendedTypes.length > 0) {
      recommendations.push(
        `Add ${missingRecommendedTypes
          .map((type) => placeActionTypeLabel(type))
          .join(", ")} links so customers can act directly from Maps.`
      );
    }
    if (configuredTypes.length === 0 && availableTypes.length > 0) {
      recommendations.push("No place action links are configured — add booking, ordering, or shop links.");
    }
    if (merchantLinkCount === 0 && input.links.some((link) => link.providerType === "AGGREGATOR_3P")) {
      recommendations.push(
        "Only third-party aggregator links are present — add merchant-owned booking or shop URLs."
      );
    }
  }

  return {
    apiAvailable,
    partialApi:
      input.probe?.partial ??
      Boolean(
        input.probe?.endpoints &&
          input.probe.endpoints.links !== input.probe.endpoints.typeMetadata
      ),
    coverageScore: Math.min(100, coverageScore),
    linkCount: input.links.length,
    merchantLinkCount,
    configuredTypes,
    availableTypes,
    missingRecommendedTypes,
    hasAppointmentLink: hasType(input.links, "APPOINTMENT"),
    hasOnlineAppointmentLink: hasType(input.links, "ONLINE_APPOINTMENT"),
    hasDiningReservationLink: hasType(input.links, "DINING_RESERVATION"),
    hasFoodOrderingLink:
      hasType(input.links, "FOOD_ORDERING") ||
      hasType(input.links, "FOOD_DELIVERY") ||
      hasType(input.links, "FOOD_TAKEOUT"),
    hasShopOnlineLink: hasType(input.links, "SHOP_ONLINE"),
    endpoints: {
      links: endpointLabel(input.probe?.endpoints?.links),
      typeMetadata: endpointLabel(input.probe?.endpoints?.typeMetadata),
    },
    recommendations: recommendations.slice(0, 5),
  };
}

export function formatPlaceActionCoverageSummary(coverage: GbpPlaceActionCoverage): string {
  if (!coverage.apiAvailable) return "unavailable";
  if (coverage.configuredTypes.length === 0) return "none configured";
  return coverage.configuredTypes
    .slice(0, 3)
    .map((type) => placeActionTypeLabel(type))
    .join(" · ");
}
