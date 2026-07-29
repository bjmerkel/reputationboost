import {
  findBusinessWithGbpLocation,
  findBusinessWithPlaceId,
  getBusinessRecord,
  listUserBusinesses,
  type BusinessRecord,
} from "@/audit/businesses";
import { listAllGbpLocations } from "@/lib/google/gbp-accounts";
import {
  rankGbpLocationsForBusiness,
  type BusinessMatchInput,
  type RankedGbpLocation,
} from "@/lib/google/gbp-onboarding-match";
import { getGbpAccessTokenForRecord } from "@/lib/google/token-store";

export interface GbpTokenSource {
  businessId: string;
  businessName: string;
  googleEmail: string;
  city: string;
  state: string;
}

export function listGbpTokenSources(rows: BusinessRecord[]): GbpTokenSource[] {
  const connected = rows.filter((row) => row.gbp_refresh_token);
  const byEmail = new Map<string, BusinessRecord>();

  for (const row of connected) {
    const email = row.gbp_google_email?.trim().toLowerCase();
    if (!email) continue;

    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, row);
      continue;
    }

    const existingAt = new Date(existing.gbp_connected_at ?? existing.updated_at).getTime();
    const rowAt = new Date(row.gbp_connected_at ?? row.updated_at).getTime();
    if (rowAt > existingAt) {
      byEmail.set(email, row);
    }
  }

  return [...byEmail.values()]
    .map((row) => ({
      businessId: row.id,
      businessName: row.name,
      googleEmail: row.gbp_google_email!,
      city: row.location?.city ?? "",
      state: row.location?.state ?? "",
    }))
    .sort((a, b) => a.googleEmail.localeCompare(b.googleEmail));
}

export function getClaimedGbpLocationIds(
  rows: BusinessRecord[],
  excludeBusinessId?: string
): Set<string> {
  return new Set(
    rows
      .filter((row) => row.id !== excludeBusinessId && row.gbp_location_id)
      .map((row) => row.gbp_location_id!)
  );
}

export function filterUnlinkedLocations(
  locations: RankedGbpLocation[],
  claimedLocationIds: Set<string>
): RankedGbpLocation[] {
  return locations.filter((location) => !claimedLocationIds.has(location.locationId));
}

export async function listImportCandidates(
  userId: string,
  sourceBusinessId: string,
  targetBusiness?: BusinessMatchInput & { businessId?: string }
): Promise<{
  googleEmail: string | null;
  locations: RankedGbpLocation[];
  totalCount: number;
  unlinkedCount: number;
}> {
  const rows = await listUserBusinesses(userId);
  const source = rows.find((row) => row.id === sourceBusinessId);
  if (!source) {
    throw new Error("Connected Google account not found.");
  }

  const accessToken = await getGbpAccessTokenForRecord(source);
  if (!accessToken) {
    throw new Error("Google Business Profile is not connected for this account.");
  }

  const allLocations = await listAllGbpLocations(accessToken);
  const ranked = await rankGbpLocationsForBusiness(
    accessToken,
    allLocations,
    targetBusiness ?? {
      name: source.name,
      placeId: source.gbp_place_id,
      address: formatBusinessAddress(source),
    }
  );

  const claimed = getClaimedGbpLocationIds(rows, targetBusiness?.businessId);
  const unlinked = filterUnlinkedLocations(ranked, claimed);

  return {
    googleEmail: source.gbp_google_email,
    locations: unlinked,
    totalCount: ranked.length,
    unlinkedCount: unlinked.length,
  };
}

export function formatBusinessAddress(business: BusinessRecord): string | undefined {
  if (!business.location) return undefined;
  return [
    business.location.address,
    business.location.city,
    business.location.state,
    business.location.zip,
  ]
    .filter(Boolean)
    .join(", ");
}

export function defaultKeywordsFromGbp(
  name: string,
  industry: string,
  city: string
): string[] {
  const category = industry
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const cityLower = city.trim().toLowerCase();
  const nameLower = name.trim().toLowerCase();

  const candidates = [
    category,
    cityLower && category ? `${cityLower} ${category}` : "",
    nameLower && cityLower ? `${nameLower} ${cityLower}` : nameLower,
    category ? `best ${category}` : "",
    cityLower ? `${cityLower} near me` : "",
  ]
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  return [...new Set(candidates)].slice(0, 3);
}

export async function assertLocationAvailable(
  userId: string,
  locationId: string,
  placeId: string | undefined,
  excludeBusinessId?: string
): Promise<void> {
  const duplicate = await findBusinessWithGbpLocation(userId, locationId, excludeBusinessId);
  if (duplicate) {
    throw new Error(`This location is already in your portfolio as "${duplicate.name}".`);
  }

  if (placeId) {
    const duplicatePlace = await findBusinessWithPlaceId(userId, placeId, excludeBusinessId);
    if (duplicatePlace) {
      throw new Error(`This location is already in your portfolio as "${duplicatePlace.name}".`);
    }
  }
}
