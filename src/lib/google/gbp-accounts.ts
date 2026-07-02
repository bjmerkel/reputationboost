import type { GbpConnection } from "@/audit/types";
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
}

function extractId(resourceName: string, segment: string): string {
  const parts = resourceName.split("/");
  const idx = parts.indexOf(segment);
  return idx >= 0 ? parts[idx + 1] : resourceName;
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

/** List locations for a GBP account. */
export async function listGbpLocations(
  accessToken: string,
  accountId: string
): Promise<GbpLocationOption[]> {
  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations`
  );
  url.searchParams.set(
    "readMask",
    "name,title,phoneNumbers,storefrontAddress,websiteUri,metadata,categories"
  );

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = (await res.json()) as {
    locations?: Array<{
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
      categories?: { primaryCategory?: { displayName?: string } };
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Failed to list locations (${res.status})`);
  }

  return (data.locations ?? []).map((loc) => {
    const addr = loc.storefrontAddress;
    const address = addr
      ? [addr.addressLines?.join(", "), addr.locality, addr.administrativeArea, addr.postalCode]
          .filter(Boolean)
          .join(", ")
      : "";

    return {
      name: loc.name ?? "",
      locationId: extractId(loc.name ?? "", "locations"),
      accountId,
      title: loc.title ?? "Untitled location",
      address,
      phone: loc.phoneNumbers?.primaryPhone ?? "",
      website: loc.websiteUri ?? "",
      placeId: loc.metadata?.placeId,
      primaryCategory: loc.categories?.primaryCategory?.displayName ?? "local business",
    };
  });
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
