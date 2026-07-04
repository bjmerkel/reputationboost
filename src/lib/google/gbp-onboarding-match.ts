import type { GbpLocationOption } from "./gbp-accounts";
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

/** Rank owned GBP locations against the business chosen in Places onboarding. */
export async function rankGbpLocationsForBusiness(
  accessToken: string,
  locations: GbpLocationOption[],
  business: BusinessMatchInput
): Promise<RankedGbpLocation[]> {
  const searchResults =
    business.name.trim().length > 0
      ? await searchGoogleLocations(accessToken, {
          title: business.name,
          address: business.address,
        }).catch(() => [])
      : [];

  const searchPlaceIds = new Set(
    searchResults.map((r) => r.placeId).filter(Boolean)
  );

  const ranked = locations.map((loc) => {
    let matchScore = 0;
    let matchReason: string | undefined;

    if (business.placeId && loc.placeId && loc.placeId === business.placeId) {
      matchScore = 100;
      matchReason = "Matches your Google Maps selection";
    } else if (loc.placeId && searchPlaceIds.has(loc.placeId)) {
      matchScore = 85;
      matchReason = "Found via Google Business location search";
    } else if (
      searchResults.some(
        (r) =>
          r.title.toLowerCase() === loc.title.toLowerCase() &&
          (!business.address ||
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

/** Pick the best auto-connect candidate when OAuth returns a single ambiguous list. */
export function bestAutoConnectLocation(
  ranked: RankedGbpLocation[]
): RankedGbpLocation | null {
  if (ranked.length === 0) return null;
  const top = ranked[0];
  if (top.recommended || ranked.length === 1) return top;
  return null;
}
