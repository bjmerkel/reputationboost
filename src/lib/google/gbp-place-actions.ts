import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";
import { analyzeGbpPlaceActionCoverage } from "./gbp-place-actions-coverage";

const PLACE_ACTIONS_BASE = "https://mybusinessplaceactions.googleapis.com/v1";

export type GbpPlaceActionType =
  | "PLACE_ACTION_TYPE_UNSPECIFIED"
  | "APPOINTMENT"
  | "ONLINE_APPOINTMENT"
  | "DINING_RESERVATION"
  | "FOOD_ORDERING"
  | "FOOD_DELIVERY"
  | "FOOD_TAKEOUT"
  | "SHOP_ONLINE";

export type GbpPlaceActionProviderType =
  | "PROVIDER_TYPE_UNSPECIFIED"
  | "MERCHANT"
  | "AGGREGATOR_3P";

export interface GbpPlaceActionLink {
  name: string;
  providerType?: GbpPlaceActionProviderType;
  isEditable?: boolean;
  uri: string;
  placeActionType: GbpPlaceActionType;
  isPreferred?: boolean;
  createTime?: string;
  updateTime?: string;
}

export interface GbpPlaceActionTypeMetadata {
  placeActionType: GbpPlaceActionType;
  displayName: string;
}

export type PlaceActionEndpointStatus = "ok" | "failed" | "denied" | "skipped";

export interface PlaceActionsApiProbe {
  ok: boolean;
  error?: string;
  permissionDenied: boolean;
  partial?: boolean;
  linkCount?: number;
  availableTypeCount?: number;
  endpoints?: {
    links: PlaceActionEndpointStatus;
    typeMetadata: PlaceActionEndpointStatus;
  };
  coverage?: ReturnType<typeof analyzeGbpPlaceActionCoverage>;
}

const PLACE_ACTION_TYPE_LABELS: Record<GbpPlaceActionType, string> = {
  PLACE_ACTION_TYPE_UNSPECIFIED: "Unspecified",
  APPOINTMENT: "Book appointment",
  ONLINE_APPOINTMENT: "Book online appointment",
  DINING_RESERVATION: "Reserve a table",
  FOOD_ORDERING: "Order food",
  FOOD_DELIVERY: "Food delivery",
  FOOD_TAKEOUT: "Food takeout",
  SHOP_ONLINE: "Shop online",
};

export function placeActionTypeLabel(type: GbpPlaceActionType | string): string {
  return PLACE_ACTION_TYPE_LABELS[type as GbpPlaceActionType] ?? String(type).replace(/_/g, " ").toLowerCase();
}

function normalizeLocationId(locationId: string): string {
  return locationId.replace(/^locations\//, "");
}

function locationParent(connection: GbpConnection): string {
  return `locations/${normalizeLocationId(connection.locationId)}`;
}

async function throwApiError(res: Response, data: unknown, fallback: string): Promise<never> {
  const message =
    (data as { error?: { message?: string } })?.error?.message ?? `${fallback} (${res.status})`;
  const err = new Error(message) as Error & { httpStatus?: number };
  err.httpStatus = res.status;
  throw err;
}

function endpointStatusFromError(error: unknown): PlaceActionEndpointStatus {
  const httpStatus = (error as Error & { httpStatus?: number }).httpStatus;
  if (httpStatus === 403 || httpStatus === 401) return "denied";
  return "failed";
}

function normalizePlaceActionLink(data: Partial<GbpPlaceActionLink>): GbpPlaceActionLink {
  return {
    name: data.name ?? "",
    providerType: data.providerType,
    isEditable: data.isEditable,
    uri: data.uri ?? "",
    placeActionType: (data.placeActionType ?? "PLACE_ACTION_TYPE_UNSPECIFIED") as GbpPlaceActionType,
    isPreferred: data.isPreferred,
    createTime: data.createTime,
    updateTime: data.updateTime,
  };
}

/** locations.placeActionLinks.list */
export async function listGbpPlaceActionLinks(
  connection: GbpConnection
): Promise<GbpPlaceActionLink[]> {
  const parent = locationParent(connection);
  const links: GbpPlaceActionLink[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${PLACE_ACTIONS_BASE}/${parent}/placeActionLinks`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: authHeadersForConnection(connection),
    });
    const data = (await res.json()) as {
      placeActionLinks?: Partial<GbpPlaceActionLink>[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      await throwApiError(res, data, "Place action links list failed");
    }

    links.push(...(data.placeActionLinks ?? []).map(normalizePlaceActionLink));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return links;
}

/** locations.placeActionLinks.get */
export async function getGbpPlaceActionLink(
  connection: GbpConnection,
  linkName: string
): Promise<GbpPlaceActionLink> {
  const name = linkName.includes("/") ? linkName : `${locationParent(connection)}/placeActionLinks/${linkName}`;
  const res = await fetch(`${PLACE_ACTIONS_BASE}/${name}`, {
    headers: authHeadersForConnection(connection),
  });
  const data = (await res.json()) as Partial<GbpPlaceActionLink> & { error?: { message?: string } };

  if (!res.ok) {
    await throwApiError(res, data, "Place action link fetch failed");
  }

  return normalizePlaceActionLink(data);
}

/** locations.placeActionLinks.create */
export async function createGbpPlaceActionLink(
  connection: GbpConnection,
  input: {
    uri: string;
    placeActionType: GbpPlaceActionType;
    isPreferred?: boolean;
  }
): Promise<GbpPlaceActionLink> {
  const parent = locationParent(connection);
  const res = await fetch(`${PLACE_ACTIONS_BASE}/${parent}/placeActionLinks`, {
    method: "POST",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uri: input.uri,
      placeActionType: input.placeActionType,
      isPreferred: input.isPreferred ?? false,
    }),
  });
  const data = (await res.json()) as Partial<GbpPlaceActionLink> & { error?: { message?: string } };

  if (!res.ok) {
    await throwApiError(res, data, "Place action link create failed");
  }

  return normalizePlaceActionLink(data);
}

/** locations.placeActionLinks.patch */
export async function patchGbpPlaceActionLink(
  connection: GbpConnection,
  link: Pick<GbpPlaceActionLink, "name"> & Partial<Pick<GbpPlaceActionLink, "uri" | "isPreferred">>,
  updateMask: string[]
): Promise<GbpPlaceActionLink> {
  const url = new URL(`${PLACE_ACTIONS_BASE}/${link.name}`);
  url.searchParams.set("updateMask", updateMask.join(","));

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: link.name,
      uri: link.uri,
      isPreferred: link.isPreferred,
    }),
  });
  const data = (await res.json()) as Partial<GbpPlaceActionLink> & { error?: { message?: string } };

  if (!res.ok) {
    await throwApiError(res, data, "Place action link update failed");
  }

  return normalizePlaceActionLink(data);
}

/** locations.placeActionLinks.delete */
export async function deleteGbpPlaceActionLink(
  connection: GbpConnection,
  linkName: string
): Promise<void> {
  const name = linkName.includes("/") ? linkName : `${locationParent(connection)}/placeActionLinks/${linkName}`;
  const res = await fetch(`${PLACE_ACTIONS_BASE}/${name}`, {
    method: "DELETE",
    headers: authHeadersForConnection(connection),
  });

  if (res.status === 404) return;

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    await throwApiError(res, data, "Place action link delete failed");
  }
}

/** placeActionTypeMetadata.list */
export async function listGbpPlaceActionTypeMetadata(
  connection: GbpConnection,
  options?: {
    languageCode?: string;
    filter?: string;
  }
): Promise<GbpPlaceActionTypeMetadata[]> {
  const metadata: GbpPlaceActionTypeMetadata[] = [];
  let pageToken: string | undefined;
  const filter =
    options?.filter ?? `location=${locationParent(connection)}`;

  do {
    const url = new URL(`${PLACE_ACTIONS_BASE}/placeActionTypeMetadata`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("filter", filter);
    if (options?.languageCode) {
      url.searchParams.set("languageCode", options.languageCode);
    }
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: authHeadersForConnection(connection),
    });
    const data = (await res.json()) as {
      placeActionTypeMetadata?: GbpPlaceActionTypeMetadata[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      await throwApiError(res, data, "Place action type metadata list failed");
    }

    metadata.push(...(data.placeActionTypeMetadata ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return metadata;
}

async function probeEndpoint(probe: () => Promise<unknown>): Promise<PlaceActionEndpointStatus> {
  try {
    await probe();
    return "ok";
  } catch (error) {
    return endpointStatusFromError(error);
  }
}

/** Quick health check for settings and onboarding. */
export async function probePlaceActionsApiAccess(
  connection: GbpConnection,
  options?: { primaryCategory?: string }
): Promise<PlaceActionsApiProbe> {
  const endpoints = {
    links: await probeEndpoint(() => listGbpPlaceActionLinks(connection)),
    typeMetadata: await probeEndpoint(() => listGbpPlaceActionTypeMetadata(connection)),
  };

  const linksOk = endpoints.links === "ok";
  const metadataOk = endpoints.typeMetadata === "ok";
  const permissionDenied = endpoints.links === "denied" || endpoints.typeMetadata === "denied";

  if (!linksOk && !metadataOk) {
    return {
      ok: false,
      permissionDenied,
      error: permissionDenied
        ? "Place Actions API access denied for this location."
        : "Place Actions API unavailable for this location.",
      endpoints,
    };
  }

  try {
    const [links, availableTypes] = await Promise.all([
      linksOk ? listGbpPlaceActionLinks(connection) : Promise.resolve([]),
      metadataOk
        ? listGbpPlaceActionTypeMetadata(connection)
        : Promise.resolve([]),
    ]);

    const coverage = analyzeGbpPlaceActionCoverage({
      links,
      availableTypes,
      primaryCategory: options?.primaryCategory,
    });

    return {
      ok: true,
      permissionDenied: false,
      partial: linksOk !== metadataOk,
      linkCount: links.length,
      availableTypeCount: availableTypes.length,
      endpoints,
      coverage,
    };
  } catch (error) {
    return {
      ok: false,
      permissionDenied: endpointStatusFromError(error) === "denied",
      error: error instanceof Error ? error.message : "Place Actions API probe failed",
      endpoints,
    };
  }
}

export const PLACE_ACTIONS_METHODS = [
  "locations.placeActionLinks.create",
  "locations.placeActionLinks.delete",
  "locations.placeActionLinks.get",
  "locations.placeActionLinks.list",
  "locations.placeActionLinks.patch",
  "placeActionTypeMetadata.list",
] as const;
