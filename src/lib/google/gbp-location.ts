import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";

export interface GbpCategoryRef {
  name: string;
  displayName: string;
}

export interface GbpLocationProfile {
  locationName: string;
  title: string;
  description: string;
  primaryCategory: GbpCategoryRef | null;
  additionalCategories: GbpCategoryRef[];
  serviceItems: Array<{ name: string; description: string }>;
  attributes: string[];
  hasRegularHours: boolean;
  hasMoreHours: boolean;
}

interface CategoryApi {
  name?: string;
  displayName?: string;
}

function locationResourceName(locationId: string): string {
  return locationId.startsWith("locations/") ? locationId : `locations/${locationId}`;
}

function normalizeCategoryName(name: string): string {
  if (name.startsWith("categories/")) return name;
  if (name.startsWith("gcid:")) return `categories/${name}`;
  return `categories/gcid:${name.replace(/^gcid:/, "")}`;
}

/** Search GBP categories by display name (e.g. "Limousine Service"). */
export async function searchGbpCategories(
  connection: GbpConnection,
  displayName: string,
  regionCode = "US"
): Promise<GbpCategoryRef[]> {
  const url = new URL("https://mybusinessbusinessinformation.googleapis.com/v1/categories");
  url.searchParams.set("regionCode", regionCode);
  url.searchParams.set("languageCode", "en");
  url.searchParams.set("view", "FULL");
  url.searchParams.set("filter", `displayName=${displayName}`);

  const res = await fetch(url.toString(), {
    headers: authHeadersForConnection(connection),
  });

  const data = (await res.json()) as {
    categories?: CategoryApi[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Category search failed (${res.status})`);
  }

  return (data.categories ?? []).map((c) => ({
    name: normalizeCategoryName(c.name ?? ""),
    displayName: c.displayName ?? displayName,
  }));
}

export async function resolveCategoryByDisplayName(
  connection: GbpConnection,
  displayName: string
): Promise<GbpCategoryRef> {
  const cleaned = displayName
    .replace(/\(Primary\)/i, "")
    .replace(/\(primary\)/i, "")
    .trim();

  const matches = await searchGbpCategories(connection, cleaned);
  const exact = matches.find(
    (m) => m.displayName.toLowerCase() === cleaned.toLowerCase()
  );
  if (exact) return exact;
  if (matches[0]) return matches[0];

  throw new Error(`Could not find GBP category for "${displayName}"`);
}

export async function getGbpLocationProfile(
  connection: GbpConnection
): Promise<GbpLocationProfile> {
  const resource = locationResourceName(connection.locationId);
  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${resource}`
  );
  url.searchParams.set(
    "readMask",
    "name,title,profile,categories,serviceItems,attributes,regularHours,moreHours"
  );

  const res = await fetch(url.toString(), {
    headers: authHeadersForConnection(connection),
  });

  const data = (await res.json()) as {
    name?: string;
    title?: string;
    profile?: { description?: string };
    categories?: {
      primaryCategory?: CategoryApi;
      additionalCategories?: CategoryApi[];
    };
    serviceItems?: Array<{
      structuredServiceItem?: { description?: string; serviceTypeId?: string };
      freeFormServiceItem?: { label?: string; description?: string; category?: string };
    }>;
    attributes?: Array<{ name?: string; values?: string[]; repeatedEnumValue?: { setValues?: string[] } }>;
    regularHours?: { periods?: unknown[] };
    moreHours?: unknown[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Failed to load location (${res.status})`);
  }

  const primary = data.categories?.primaryCategory;
  const additional = data.categories?.additionalCategories ?? [];

  const serviceItems = (data.serviceItems ?? [])
    .map((item) => {
      const free = item.freeFormServiceItem;
      const structured = item.structuredServiceItem;
      const name = free?.label ?? structured?.serviceTypeId ?? "";
      const description = free?.description ?? structured?.description ?? "";
      if (!name && !description) return null;
      return { name: name || "Service", description };
    })
    .filter((s): s is { name: string; description: string } => Boolean(s));

  const attributes: string[] = [];
  for (const attr of data.attributes ?? []) {
    if (attr.repeatedEnumValue?.setValues?.length) {
      attributes.push(...attr.repeatedEnumValue.setValues);
    } else if (attr.values?.length) {
      attributes.push(...attr.values);
    } else if (attr.name) {
      attributes.push(attr.name);
    }
  }

  return {
    locationName: data.name ?? resource,
    title: data.title ?? "",
    description: data.profile?.description ?? "",
    primaryCategory: primary?.name
      ? {
          name: normalizeCategoryName(primary.name),
          displayName: primary.displayName ?? "",
        }
      : null,
    additionalCategories: additional
      .filter((c) => c.name)
      .map((c) => ({
        name: normalizeCategoryName(c.name!),
        displayName: c.displayName ?? "",
      })),
    serviceItems,
    attributes,
    hasRegularHours: Boolean(data.regularHours?.periods?.length),
    hasMoreHours: Boolean(data.moreHours?.length),
  };
}

export async function patchGbpLocation(
  connection: GbpConnection,
  updateMask: string,
  body: Record<string, unknown>,
  validateOnly = false
): Promise<void> {
  const resource = locationResourceName(connection.locationId);
  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${resource}`
  );
  url.searchParams.set("updateMask", updateMask);
  if (validateOnly) url.searchParams.set("validateOnly", "true");

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `GBP update failed (${res.status})`);
  }
}

export { normalizeCategoryName };
