import type { GbpLocationOption } from "./gbp-accounts";
import { searchGbpChains } from "./gbp-chains";
import { searchGoogleLocations } from "./gbp-location";

export interface RankedGbpLocation extends GbpLocationOption {
  matchScore: number;
  matchReason?: string;
  recommended?: boolean;
}

export interface BusinessMatchInput {
  name: string;
  placeId?: string | null;
  address?: string;
}

export interface LocationSelectionValidation {
  valid: boolean;
  matchScore: number;
  matchReason?: string;
  warning?: string;
}

/** Rank owned GBP locations against the business chosen in Places onboarding. */
export async function rankGbpLocationsForBusiness(
  accessToken: string,
  locations: GbpLocationOption[],
  business: BusinessMatchInput
): Promise<RankedGbpLocation[]> {
  const [searchResults, chainMatches] = await Promise.all([
    business.name.trim().length > 0
      ? searchGoogleLocations(accessToken, {
          title: business.name,
          address: business.address,
        }).catch(() => [])
      : Promise.resolve([]),
    business.name.trim().length > 0
      ? searchGbpChains(accessToken, business.name, 5).catch(() => [])
      : Promise.resolve([]),
  ]);

  const searchPlaceIds = new Set(
    searchResults.map((r) => r.placeId).filter(Boolean)
  );

  const matchedChainIds = new Set(chainMatches.map((chain) => chain.name));

  const ranked = locations.map((loc) => {
    let matchScore = 0;
    let matchReason: string | undefined;

    if (business.placeId && loc.placeId && loc.placeId === business.placeId) {
      matchScore = 100;
      matchReason = "Matches your Google Maps selection";
    } else if (loc.placeId && searchPlaceIds.has(loc.placeId)) {
      matchScore = 85;
      matchReason = "Found via Google Business location search";
    } else if (loc.parentChainId && matchedChainIds.has(loc.parentChainId)) {
      matchScore = 75;
      matchReason = loc.chainDisplayName
        ? `Part of the ${loc.chainDisplayName} chain`
        : "Matches your brand chain on Google";
    } else if (
      searchResults.some(
        (r) =>
          r.title.toLowerCase() === loc.title.toLowerCase() &&
          (!business.address ||
            !r.address ||
            r.address.toLowerCase().includes(business.address.split(",")[0].toLowerCase()))
      )
    ) {
      matchScore = 65;
      matchReason = "Similar name and address in Google search";
    } else if (
      business.name &&
      loc.title.toLowerCase().includes(business.name.toLowerCase().slice(0, 8))
    ) {
      matchScore = 40;
      matchReason = "Partial name match";
    }

    return {
      ...loc,
      matchScore,
      matchReason,
      recommended: matchScore >= 85,
    };
  });

  ranked.sort((a, b) => b.matchScore - a.matchScore);
  return ranked;
}

/** Validate a manually selected GBP location before saving. */
export async function validateGbpLocationSelection(
  accessToken: string,
  location: GbpLocationOption,
  business: BusinessMatchInput
): Promise<LocationSelectionValidation> {
  const [ranked] = await rankGbpLocationsForBusiness(accessToken, [location], business);
  const matchScore = ranked?.matchScore ?? 0;
  const matchReason = ranked?.matchReason;

  if (
    business.placeId &&
    location.placeId &&
    location.placeId !== business.placeId &&
    matchScore < 65
  ) {
    return {
      valid: false,
      matchScore,
      matchReason,
      warning:
        "This location does not match the business you selected on Google Maps. Choose the recommended location or verify the listing.",
    };
  }

  if (matchScore < 40) {
    return {
      valid: false,
      matchScore,
      matchReason,
      warning:
        "This location does not appear to match your business. Double-check the name and address before continuing.",
    };
  }

  return {
    valid: true,
    matchScore,
    matchReason,
    warning:
      matchScore < 85
        ? "This location is a partial match. Verify it is the correct listing before continuing."
        : undefined,
  };
}

/** Pick the best auto-connect candidate when OAuth returns a single ambiguous list. */
export function bestAutoConnectLocation(
  ranked: RankedGbpLocation[]
): RankedGbpLocation | null {
  if (ranked.length === 0) return null;
  const top = ranked[0];
  if (top.recommended || ranked.length === 1) return top;
  return null;
}
