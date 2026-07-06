import type { GbpConnection } from "@/audit/types";
import { batchGetGbpCategoriesWithToken } from "./gbp-location";
import { categoryStableId } from "./gbp-service-items";
import { resolveGbpChainLabels } from "./gbp-chains";
import { authHeadersForConnection } from "./token-store";

export interface GbpAccount {
  name: string;
  accountId: string;
  accountName: string;
  type: string;
}

export interface GbpLocationOption {
  name: string;
  locationId: string;
  accountId: string;
  title: string;
  address: string;
  phone: string;
  website: string;
  placeId?: string;
  primaryCategory: string;
  primaryCategoryId?: string;
  parentChainId?: string;
  chainDisplayName?: string;
}

const LOCATION_READ_MASK =
  "name,title,phoneNumbers,storefrontAddress,websiteUri,metadata,categories,relationshipData";

function extractId(resourceName: string, segment: string): string {
  const parts = resourceName.split("/");
  const idx = parts.indexOf(segment);
  return idx >= 0 ? parts[idx + 1] : resourceName;
}

/** Normalize to the v1 API's stable category ID format ("gcid:x"). */
function normalizeCategoryResourceName(name: string): string {
  return categoryStableId(name);
}

interface LocationListItem {
  name?: string;
  title?: string;
  phoneNumbers?: { primaryPhone?: string };
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
  websiteUri?: string;
  metadata?: { placeId?: string };
  categories?: {
    primaryCategory?: { name?: string; displayName?: string };
  };
  relationshipData?: { parentChain?: string };
}

function mapLocationOption(
  loc: LocationListItem,
  accountId: string
): GbpLocationOption {
  const addr = loc.storefrontAddress;
  const address = addr
    ? [addr.addressLines?.join(", "), addr.locality, addr.administrativeArea, addr.postalCode]
        .filter(Boolean)
        .join(", ")
    : "";

  const primary = loc.categories?.primaryCategory;

  return {
    name: loc.name ?? "",
    locationId: extractId(loc.name ?? "", "locations"),
    accountId,
    title: loc.title ?? "Untitled location",
    address,
    phone: loc.phoneNumbers?.primaryPhone ?? "",
    website: loc.websiteUri ?? "",
    placeId: loc.metadata?.placeId,
    primaryCategory: primary?.displayName ?? "local business",
    primaryCategoryId: primary?.name
      ? normalizeCategoryResourceName(primary.name)
      : undefined,
    parentChainId: loc.relationshipData?.parentChain,
  };
}

/** List GBP accounts the user has access to. */
export async function listGbpAccounts(accessToken: string): Promise<GbpAccount[]> {
  const res = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = (await res.json()) as {
    accounts?: Array<{
      name?: string;
      accountName?: string;
      type?: string;
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Failed to list GBP accounts (${res.status})`);
  }

  return (data.accounts ?? []).map((account) => ({
    name: account.name ?? "",
    accountId: extractId(account.name ?? "", "accounts"),
    accountName: account.accountName ?? "Account",
    type: account.type ?? "UNKNOWN",
  }));
}

/** List locations for a GBP account (paginated, up to 100 per page). */
export async function listGbpLocations(
  accessToken: string,
  accountId: string
): Promise<GbpLocationOption[]> {
  const all: GbpLocationOption[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations`
    );
    url.searchParams.set("readMask", LOCATION_READ_MASK);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = (await res.json()) as {
      locations?: LocationListItem[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(data.error?.message ?? `Failed to list locations (${res.status})`);
    }

    all.push(...(data.locations ?? []).map((loc) => mapLocationOption(loc, accountId)));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return enrichLocationOptions(accessToken, all);
}

/** Enrich listed locations with category display names and chain labels. */
export async function enrichLocationOptions(
  accessToken: string,
  locations: GbpLocationOption[]
): Promise<GbpLocationOption[]> {
  if (locations.length === 0) return locations;

  const categoryIds = [
    ...new Set(
      locations
        .filter((loc) => loc.primaryCategoryId && loc.primaryCategory === "local business")
        .map((loc) => loc.primaryCategoryId!)
    ),
  ];

  const chainIds = [
    ...new Set(locations.map((loc) => loc.parentChainId).filter(Boolean) as string[]),
  ];

  const [categoryLabels, chainLabels] = await Promise.all([
    categoryIds.length > 0
      ? batchGetGbpCategoriesWithToken(accessToken, categoryIds).catch(() => [])
      : Promise.resolve([]),
    chainIds.length > 0 ? resolveGbpChainLabels(accessToken, chainIds) : Promise.resolve(new Map()),
  ]);

  const categoryByName = new Map(categoryLabels.map((c) => [c.name, c.displayName]));

  return locations.map((loc) => ({
    ...loc,
    primaryCategory:
      loc.primaryCategoryId && categoryByName.has(loc.primaryCategoryId)
        ? categoryByName.get(loc.primaryCategoryId)!
        : loc.primaryCategory,
    chainDisplayName: loc.parentChainId ? chainLabels.get(loc.parentChainId) : undefined,
  }));
}

/** List all locations across all accounts. */
export async function listAllGbpLocations(accessToken: string): Promise<GbpLocationOption[]> {
  const accounts = await listGbpAccounts(accessToken);
  const all: GbpLocationOption[] = [];

  for (const account of accounts) {
    const locations = await listGbpLocations(accessToken, account.accountId);
    all.push(...locations);
  }

  return all;
}

export async function listLocationsForConnection(
  connection: GbpConnection
): Promise<GbpLocationOption[]> {
  return listGbpLocations(connection.accessToken, connection.accountId);
}

export { authHeadersForConnection };
