import type { GbpConnection } from "@/audit/types";
import type { GbpGoogleSuggestion } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";
import { diffGoogleUpdatedLocation, diffGoogleUpdatedAttributes } from "./gbp-google-updated";
import type { BusinessHours, SpecialHours } from "./gbp-hours";
import {
  hasFullWeekCoverage,
  hasSpecialHourPeriods,
} from "./gbp-hours";

const BI_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";

export interface GbpCategoryRef {
  name: string;
  displayName: string;
}

export interface GbpLocationAttribute {
  name: string;
  displayName?: string;
  valueType?: string;
  values: string[];
}

export interface GbpLocationProfile {
  locationName: string;
  title: string;
  description: string;
  phone: string;
  additionalPhones: string[];
  website: string;
  address: string;
  placeId: string;
  mapsUri: string;
  primaryCategory: GbpCategoryRef | null;
  additionalCategories: GbpCategoryRef[];
  serviceItems: Array<{ name: string; description: string; raw?: Record<string, unknown> }>;
  attributes: string[];
  attributeDetails: GbpLocationAttribute[];
  hasRegularHours: boolean;
  hasFullWeekHours: boolean;
  hasMoreHours: boolean;
  hasSpecialHours: boolean;
  hasGoogleUpdated: boolean;
  hasPendingEdits: boolean;
  canModifyServiceList: boolean;
  regularHours: BusinessHours | null;
  specialHours: SpecialHours | null;
  serviceAreaPlaces: GbpServiceAreaPlace[];
  isServiceAreaBusiness: boolean;
  businessLatLng: { lat: number; lng: number } | null;
}

export interface GbpServiceAreaPlace {
  placeId: string;
  placeName: string;
}

export interface GbpAttributeMetadata {
  name: string;
  displayName: string;
  groupDisplayName: string;
  valueType: string;
  deprecated: boolean;
}

export interface GbpAttributeUpdate {
  name: string;
  boolValue?: boolean;
  enumValues?: string[];
  uri?: string;
}

interface CategoryApi {
  name?: string;
  displayName?: string;
  serviceTypes?: Array<{ serviceTypeId?: string; displayName?: string }>;
}

interface AttributeApi {
  name?: string;
  valueType?: string;
  values?: unknown[];
  repeatedEnumValue?: { setValues?: string[]; unsetValues?: string[] };
  uriValues?: Array<{ uri?: string }>;
}

interface LocationApi {
  name?: string;
  title?: string;
  profile?: { description?: string };
  phoneNumbers?: { primaryPhone?: string; additionalPhones?: string[] };
  websiteUri?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  categories?: {
    primaryCategory?: CategoryApi;
    additionalCategories?: CategoryApi[];
  };
  serviceItems?: Array<{
    structuredServiceItem?: { description?: string; serviceTypeId?: string };
    freeFormServiceItem?: {
      label?: { displayName?: string; description?: string };
      category?: string;
    };
  }>;
  attributes?: AttributeApi[];
  regularHours?: BusinessHours;
  specialHours?: SpecialHours;
  moreHours?: unknown[];
  metadata?: {
    placeId?: string;
    mapsUri?: string;
    hasGoogleUpdated?: boolean;
    hasPendingEdits?: boolean;
    canModifyServiceList?: boolean;
  };
  serviceArea?: {
    businessType?: string;
    places?: {
      placeInfos?: Array<{ placeId?: string; placeName?: string }>;
    };
  };
  latlng?: { latitude?: number; longitude?: number };
  error?: { message?: string };
}

function locationResourceName(locationId: string): string {
  return locationId.startsWith("locations/") ? locationId : `locations/${locationId}`;
}

function locationAttributesResourceName(locationId: string): string {
  const loc = locationResourceName(locationId);
  return `${loc}/attributes`;
}

function normalizeCategoryName(name: string): string {
  if (name.startsWith("categories/")) return name;
  if (name.startsWith("gcid:")) return `categories/${name}`;
  return `categories/gcid:${name.replace(/^gcid:/, "")}`;
}

function formatStorefrontAddress(
  addr: NonNullable<LocationApi["storefrontAddress"]>
): string {
  return [
    addr.addressLines?.join(", "),
    addr.locality,
    addr.administrativeArea,
    addr.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function attributeKey(name: string): string {
  return name.split("/").pop() ?? name;
}

function humanizeAttributeKey(key: string): string {
  return key
    .replace(/^attributes\//, "")
    .replace(/^has_/, "")
    .replace(/^is_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function coerceAttributeValues(attr: AttributeApi): string[] {
  const values: string[] = [];

  if (attr.repeatedEnumValue?.setValues?.length) {
    values.push(...attr.repeatedEnumValue.setValues);
  }

  if (attr.values?.length) {
    for (const value of attr.values) {
      if (typeof value === "boolean") {
        values.push(value ? "__BOOL_TRUE__" : "__BOOL_FALSE__");
      } else {
        values.push(String(value));
      }
    }
  }

  if (attr.uriValues?.length) {
    values.push(...attr.uriValues.map((u) => u.uri ?? "").filter(Boolean));
  }

  return values;
}

export function isEnabledGbpAttribute(attr: GbpLocationAttribute): boolean {
  const valueType = attr.valueType?.toUpperCase() ?? "";

  if (valueType === "BOOL" || valueType === "BOOLEAN") {
    if (attr.values.length === 0) return true;
    return attr.values.some((v) => v === "__BOOL_TRUE__" || v === "true");
  }

  if (valueType === "REPEATED_ENUM" || valueType === "ENUM") {
    return attr.values.length > 0;
  }

  return attr.values.length > 0;
}

export function formatGbpAttributeLabel(
  attr: GbpLocationAttribute,
  metadataByKey: Map<string, GbpAttributeMetadata>
): string | null {
  if (!isEnabledGbpAttribute(attr)) return null;

  const key = attributeKey(attr.name);
  const meta = metadataByKey.get(key) ?? metadataByKey.get(attr.name);
  const enumValues = attr.values
    .filter((v) => !v.startsWith("__BOOL_") && v !== "true" && v !== "false")
    .map((v) => humanizeAttributeKey(v));

  if (meta?.displayName) {
    return enumValues.length ? `${meta.displayName}: ${enumValues.join(", ")}` : meta.displayName;
  }

  if (enumValues.length) return enumValues.join(", ");
  return humanizeAttributeKey(key);
}

function parseInlineAttributes(attrs: AttributeApi[] | undefined): {
  labels: string[];
  details: GbpLocationAttribute[];
} {
  const details: GbpLocationAttribute[] = [];

  for (const attr of attrs ?? []) {
    const values = coerceAttributeValues(attr);

    if (attr.name) {
      details.push({
        name: attr.name,
        valueType: attr.valueType,
        values,
      });
    }
  }

  const labels = details
    .filter(isEnabledGbpAttribute)
    .map((attr) => formatGbpAttributeLabel(attr, new Map()) ?? "")
    .filter(Boolean);

  return { labels, details };
}

function parseServiceItems(
  items: LocationApi["serviceItems"]
): Array<{ name: string; description: string; raw?: Record<string, unknown> }> {
  return (items ?? [])
    .map((item) => {
      const free = item.freeFormServiceItem;
      const structured = item.structuredServiceItem;
      const name = free?.label?.displayName ?? structured?.serviceTypeId ?? "";
      const description = free?.label?.description ?? structured?.description ?? "";
      if (!name && !description) return null;
      const parsed: { name: string; description: string; raw?: Record<string, unknown> } = {
        name: name || "Service",
        description,
        raw: item as Record<string, unknown>,
      };
      return parsed;
    })
    .filter((s): s is { name: string; description: string; raw?: Record<string, unknown> } =>
      Boolean(s)
    );
}

function apiErrorMessage(data: { error?: { message?: string } }, fallback: string): string {
  return data.error?.message ?? fallback;
}

async function biFetch<T>(
  connection: GbpConnection,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BI_BASE}/${path}`, {
    ...init,
    headers: {
      ...authHeadersForConnection(connection),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(apiErrorMessage(data, `Business Information API failed (${res.status})`));
  }
  return data;
}

/** Search GBP categories by display name (e.g. "RV dealer"). */
export async function searchGbpCategories(
  connection: GbpConnection,
  displayName: string,
  regionCode = "US"
): Promise<GbpCategoryRef[]> {
  const url = new URL(`${BI_BASE}/categories`);
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

async function batchGetCategoriesRaw(
  accessToken: string,
  categoryNames: string[],
  regionCode = "US"
): Promise<CategoryApi[]> {
  if (categoryNames.length === 0) return [];

  const params = new URLSearchParams();
  params.set("regionCode", regionCode);
  params.set("languageCode", "en");
  params.set("view", "FULL");
  for (const name of categoryNames) {
    params.append("names", normalizeCategoryName(name));
  }

  const res = await fetch(`${BI_BASE}/categories:batchGet?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = (await res.json()) as {
    categories?: CategoryApi[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Category batchGet failed (${res.status})`);
  }

  return data.categories ?? [];
}

/** categories.batchGet — resolve category IDs to display names (access token). */
export async function batchGetGbpCategoriesWithToken(
  accessToken: string,
  categoryNames: string[],
  regionCode = "US"
): Promise<GbpCategoryRef[]> {
  const categories = await batchGetCategoriesRaw(accessToken, categoryNames, regionCode);
  return categories.map((c) => ({
    name: normalizeCategoryName(c.name ?? ""),
    displayName: c.displayName ?? c.name ?? "",
  }));
}

/** categories.batchGet — resolve category IDs to display names. */
export async function batchGetGbpCategories(
  connection: GbpConnection,
  categoryNames: string[],
  regionCode = "US"
): Promise<GbpCategoryRef[]> {
  return batchGetGbpCategoriesWithToken(connection.accessToken, categoryNames, regionCode);
}

/** Resolve structured serviceTypeId values via categories.batchGet service types. */
export async function resolveGbpServiceTypeLabels(
  connection: GbpConnection,
  primaryCategoryName: string | null | undefined,
  serviceTypeIds: string[]
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (!primaryCategoryName || serviceTypeIds.length === 0) return labels;

  const categories = await batchGetCategoriesRaw(
    connection.accessToken,
    [primaryCategoryName]
  );

  for (const category of categories) {
    for (const serviceType of category.serviceTypes ?? []) {
      if (serviceType.serviceTypeId && serviceType.displayName) {
        labels.set(serviceType.serviceTypeId, serviceType.displayName);
      }
    }
  }

  return labels;
}

export interface GbpServiceTypeRef {
  serviceTypeId: string;
  displayName: string;
}

/** List structured service types available for a primary category. */
export async function listGbpServiceTypes(
  connection: GbpConnection,
  primaryCategoryName: string
): Promise<GbpServiceTypeRef[]> {
  const categories = await batchGetCategoriesRaw(connection.accessToken, [primaryCategoryName]);
  const serviceTypes = categories[0]?.serviceTypes ?? [];

  return serviceTypes
    .filter((serviceType) => serviceType.serviceTypeId && serviceType.displayName)
    .map((serviceType) => ({
      serviceTypeId: serviceType.serviceTypeId!,
      displayName: serviceType.displayName!,
    }));
}

/** Resolve a human-readable service name to Google's structured serviceTypeId. */
export async function lookupServiceTypeForDisplayName(
  connection: GbpConnection,
  primaryCategoryName: string,
  displayName: string
): Promise<GbpServiceTypeRef | null> {
  const needle = displayName.trim().toLowerCase();
  if (!needle) return null;

  const serviceTypes = await listGbpServiceTypes(connection, primaryCategoryName);
  const exact = serviceTypes.find((serviceType) => serviceType.displayName.toLowerCase() === needle);
  if (exact) return exact;

  const partial = serviceTypes.find(
    (serviceType) =>
      serviceType.displayName.toLowerCase().includes(needle) ||
      needle.includes(serviceType.displayName.toLowerCase())
  );
  return partial ?? null;
}

function summarizeAttributeForDiff(
  attr: GbpLocationAttribute,
  metadataByKey: Map<string, GbpAttributeMetadata>
): string {
  const key = attributeKey(attr.name);
  const meta = metadataByKey.get(key) ?? metadataByKey.get(attr.name);
  const label = meta?.displayName ?? humanizeAttributeKey(key);

  if (!isEnabledGbpAttribute(attr)) {
    return `${label}: disabled`;
  }

  const formatted = formatGbpAttributeLabel(attr, metadataByKey);
  return formatted ? `${label}: ${formatted}` : `${label}: enabled`;
}

function attributeApiToGbpLocationAttribute(attr: AttributeApi): GbpLocationAttribute | null {
  if (!attr.name) return null;
  const { details } = parseInlineAttributes([attr]);
  return details[0] ?? null;
}

/** Convert a Google attribute payload into an update request. */
export function attributeApiToUpdate(attr: AttributeApi): GbpAttributeUpdate | null {
  if (!attr.name) return null;

  if (attr.values?.length === 1 && typeof attr.values[0] === "boolean") {
    return { name: attr.name, boolValue: attr.values[0] };
  }

  if (attr.repeatedEnumValue?.setValues?.length) {
    return { name: attr.name, enumValues: attr.repeatedEnumValue.setValues };
  }

  if (attr.uriValues?.length) {
    const uri = attr.uriValues[0]?.uri;
    if (uri) return { name: attr.name, uri };
  }

  const parsed = attributeApiToGbpLocationAttribute(attr);
  if (!parsed) return null;

  if (parsed.valueType?.toUpperCase() === "BOOL" || parsed.valueType?.toUpperCase() === "BOOLEAN") {
    const enabled = isEnabledGbpAttribute(parsed);
    return { name: attr.name, boolValue: enabled };
  }

  if (parsed.values.length > 0) {
    return { name: attr.name, enumValues: parsed.values };
  }

  return null;
}

/** Fill missing category display names and structured service labels. */
export async function enrichGbpLocationProfile(
  connection: GbpConnection,
  profile: GbpLocationProfile
): Promise<GbpLocationProfile> {
  const categoryNames = [
    profile.primaryCategory?.name,
    ...profile.additionalCategories.map((c) => c.name),
  ].filter((name): name is string => Boolean(name));

  const needsCategoryLabels =
    !profile.primaryCategory?.displayName ||
    profile.additionalCategories.some((c) => !c.displayName);

  const serviceTypeIds = profile.serviceItems
    .map((item) => item.raw?.structuredServiceItem as { serviceTypeId?: string } | undefined)
    .map((structured) => structured?.serviceTypeId)
    .filter((id): id is string => Boolean(id));

  const [categoryRefs, serviceLabels] = await Promise.all([
    needsCategoryLabels && categoryNames.length > 0
      ? batchGetGbpCategories(connection, categoryNames).catch(() => [])
      : Promise.resolve([]),
    serviceTypeIds.length > 0
      ? resolveGbpServiceTypeLabels(connection, profile.primaryCategory?.name, serviceTypeIds)
      : Promise.resolve(new Map<string, string>()),
  ]);

  const categoryByName = new Map(categoryRefs.map((c) => [c.name, c.displayName]));

  const primaryCategory = profile.primaryCategory
    ? {
        ...profile.primaryCategory,
        displayName:
          profile.primaryCategory.displayName ||
          categoryByName.get(profile.primaryCategory.name) ||
          profile.primaryCategory.name,
      }
    : null;

  const additionalCategories = profile.additionalCategories.map((category) => ({
    ...category,
    displayName:
      category.displayName || categoryByName.get(category.name) || category.name,
  }));

  const serviceItems = profile.serviceItems.map((item) => {
    const structured = item.raw?.structuredServiceItem as
      | { serviceTypeId?: string; description?: string }
      | undefined;
    const serviceTypeId = structured?.serviceTypeId;
    if (!serviceTypeId) return item;

    const label = serviceLabels.get(serviceTypeId) ?? serviceTypeId;
    return {
      ...item,
      name: item.name === serviceTypeId ? label : item.name,
    };
  });

  return {
    ...profile,
    primaryCategory,
    additionalCategories,
    serviceItems,
  };
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

/** locations.get — full location profile. */
export async function getGbpLocationProfile(
  connection: GbpConnection
): Promise<GbpLocationProfile> {
  const resource = locationResourceName(connection.locationId);
  const params = new URLSearchParams();
  params.set(
    "readMask",
    [
      "name",
      "title",
      "profile",
      "phoneNumbers",
      "websiteUri",
      "storefrontAddress",
      "categories",
      "serviceItems",
      "attributes",
      "regularHours",
      "specialHours",
      "moreHours",
      "metadata",
      "serviceArea",
      "latlng",
    ].join(",")
  );

  const data = await biFetch<LocationApi>(connection, `${resource}?${params.toString()}`);

  const primary = data.categories?.primaryCategory;
  const additional = data.categories?.additionalCategories ?? [];
  const { labels, details } = parseInlineAttributes(data.attributes);
  const serviceAreaPlaces =
    data.serviceArea?.places?.placeInfos
      ?.filter((p) => p.placeId && p.placeName)
      .map((p) => ({
        placeId: p.placeId!,
        placeName: p.placeName!,
      })) ?? [];

  return {
    locationName: data.name ?? resource,
    title: data.title ?? "",
    description: data.profile?.description ?? "",
    phone: data.phoneNumbers?.primaryPhone ?? "",
    additionalPhones: data.phoneNumbers?.additionalPhones ?? [],
    website: data.websiteUri ?? "",
    address: data.storefrontAddress ? formatStorefrontAddress(data.storefrontAddress) : "",
    placeId: data.metadata?.placeId ?? "",
    mapsUri: data.metadata?.mapsUri ?? "",
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
    serviceItems: parseServiceItems(data.serviceItems),
    attributes: labels,
    attributeDetails: details,
    hasRegularHours: Boolean(data.regularHours?.periods?.length),
    hasFullWeekHours: hasFullWeekCoverage(data.regularHours),
    hasMoreHours: Boolean(data.moreHours?.length),
    hasSpecialHours: hasSpecialHourPeriods(data.specialHours),
    hasGoogleUpdated: Boolean(data.metadata?.hasGoogleUpdated),
    hasPendingEdits: Boolean(data.metadata?.hasPendingEdits),
    canModifyServiceList: data.metadata?.canModifyServiceList !== false,
    regularHours: data.regularHours ?? null,
    specialHours: data.specialHours ?? null,
    serviceAreaPlaces,
    isServiceAreaBusiness: serviceAreaPlaces.length > 0,
    businessLatLng:
      data.latlng?.latitude != null && data.latlng?.longitude != null
        ? { lat: data.latlng.latitude, lng: data.latlng.longitude }
        : null,
  };
}

/** locations.getAttributes — dedicated attributes resource. */
export async function getLocationAttributes(
  connection: GbpConnection
): Promise<GbpLocationAttribute[]> {
  const resource = locationAttributesResourceName(connection.locationId);
  const data = await biFetch<{ attributes?: AttributeApi[] }>(connection, resource);
  const { details } = parseInlineAttributes(data.attributes);
  return details;
}

/** attributes.list — metadata for attributes available to this location/category. */
export async function listAvailableAttributes(
  connection: GbpConnection,
  options?: {
    parent?: string;
    categoryName?: string;
    regionCode?: string;
    languageCode?: string;
  }
): Promise<GbpAttributeMetadata[]> {
  const resource = locationResourceName(connection.locationId);
  const baseParams = new URLSearchParams();

  if (options?.parent) {
    baseParams.set("parent", options.parent);
  } else if (options?.categoryName) {
    baseParams.set("categoryName", normalizeCategoryName(options.categoryName));
    baseParams.set("regionCode", options.regionCode ?? "US");
    baseParams.set("languageCode", options.languageCode ?? "en");
  } else {
    baseParams.set("parent", resource);
  }

  const results: GbpAttributeMetadata[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams(baseParams);
    if (pageToken) params.set("pageToken", pageToken);

    const data = await biFetch<{
      attributeMetadata?: Array<{
        parent?: string;
        displayName?: string;
        groupDisplayName?: string;
        valueType?: string;
        deprecated?: boolean;
      }>;
      nextPageToken?: string;
    }>(connection, `attributes?${params.toString()}`);

    for (const meta of data.attributeMetadata ?? []) {
      if (!meta.parent || meta.deprecated) continue;
      results.push({
        name: meta.parent,
        displayName: meta.displayName ?? meta.parent,
        groupDisplayName: meta.groupDisplayName ?? "",
        valueType: meta.valueType ?? "ATTRIBUTE_VALUE_TYPE_UNSPECIFIED",
        deprecated: Boolean(meta.deprecated),
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken && results.length < 500);

  return results;
}

/** locations.updateAttributes — set attribute values. */
export async function updateLocationAttributes(
  connection: GbpConnection,
  updates: GbpAttributeUpdate[]
): Promise<void> {
  if (updates.length === 0) return;

  const resource = locationAttributesResourceName(connection.locationId);
  const attributes: AttributeApi[] = updates.map((update) => {
    const attr: AttributeApi = { name: update.name };
    if (update.boolValue !== undefined) {
      attr.values = [update.boolValue];
    } else if (update.enumValues?.length) {
      attr.repeatedEnumValue = { setValues: update.enumValues, unsetValues: [] };
    } else if (update.uri) {
      attr.uriValues = [{ uri: update.uri }];
    }
    return attr;
  });

  const attributeMask = updates.map((u) => u.name).join(",");
  const url = new URL(`${BI_BASE}/${resource}`);
  url.searchParams.set("attributeMask", attributeMask);

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: resource, attributes }),
  });

  const data = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Attribute update failed (${res.status})`);
  }
}

/** locations.getGoogleUpdated — Google's suggested edits for this location. */
export async function getGoogleUpdatedLocation(
  connection: GbpConnection
): Promise<Record<string, unknown>> {
  const resource = locationResourceName(connection.locationId);
  const params = new URLSearchParams();
  params.set(
    "readMask",
    "name,title,profile,phoneNumbers,websiteUri,storefrontAddress,categories,serviceItems,regularHours,specialHours"
  );

  const data = await biFetch<{ location?: Record<string, unknown> }>(
    connection,
    `${resource}:getGoogleUpdated?${params.toString()}`
  );

  return data.location ?? data;
}

/** locations.attributes.getGoogleUpdated — Google's suggested attribute changes. */
export async function getGoogleUpdatedAttributes(
  connection: GbpConnection
): Promise<Record<string, unknown>> {
  const resource = locationAttributesResourceName(connection.locationId);
  const data = await biFetch<Record<string, unknown>>(
    connection,
    `${resource}:getGoogleUpdated`
  );
  return data;
}

/** Build owner location object for diffing against Google suggestions. */
export function ownerLocationForDiff(profile: GbpLocationProfile): Record<string, unknown> {
  return {
    title: profile.title,
    profile: { description: profile.description },
    phoneNumbers: { primaryPhone: profile.phone },
    websiteUri: profile.website,
    categories: {
      primaryCategory: profile.primaryCategory
        ? { displayName: profile.primaryCategory.displayName, name: profile.primaryCategory.name }
        : undefined,
    },
    storefrontAddress: profile.address ? { addressLines: [profile.address] } : undefined,
    regularHours: profile.regularHours,
    specialHours: profile.specialHours,
  };
}

/** Fetch Google-suggested location edits when metadata indicates changes. */
export async function fetchGoogleSuggestions(
  connection: GbpConnection,
  profile: GbpLocationProfile
): Promise<GbpGoogleSuggestion[]> {
  if (!profile.hasGoogleUpdated && !profile.hasPendingEdits) return [];

  try {
    const googleUpdated = await getGoogleUpdatedLocation(connection);
    return diffGoogleUpdatedLocation(ownerLocationForDiff(profile), googleUpdated);
  } catch {
    return [];
  }
}

/** locations.attributes.getGoogleUpdated — attribute-level Google suggestions. */
export async function fetchGoogleAttributeSuggestions(
  connection: GbpConnection,
  profile: GbpLocationProfile
): Promise<GbpGoogleSuggestion[]> {
  if (!profile.hasGoogleUpdated && !profile.hasPendingEdits) return [];

  try {
    const [ownerAttributes, googleRaw, available] = await Promise.all([
      getLocationAttributes(connection),
      getGoogleUpdatedAttributes(connection),
      listAvailableAttributes(connection).catch(() => [] as GbpAttributeMetadata[]),
    ]);

    const metadataByKey = new Map<string, GbpAttributeMetadata>();
    for (const meta of available) {
      metadataByKey.set(attributeKey(meta.name), meta);
      metadataByKey.set(meta.name, meta);
    }

    const googleAttributes = (googleRaw.attributes as AttributeApi[] | undefined) ?? [];
    const ownerByName = new Map(
      ownerAttributes.map((attr) => [
        attr.name,
        summarizeAttributeForDiff(attr, metadataByKey),
      ])
    );

    const inputs = googleAttributes
      .map((attr) => attributeApiToGbpLocationAttribute(attr))
      .filter((attr): attr is GbpLocationAttribute => Boolean(attr))
      .map((attr) => {
        const key = attributeKey(attr.name);
        const meta = metadataByKey.get(key) ?? metadataByKey.get(attr.name);
        return {
          name: attr.name,
          label: meta?.displayName ?? humanizeAttributeKey(key),
          ownerSummary: ownerByName.get(attr.name) ?? "(not set)",
          googleSummary: summarizeAttributeForDiff(attr, metadataByKey),
        };
      });

    return diffGoogleUpdatedAttributes(inputs);
  } catch {
    return [];
  }
}

/** Fetch both profile-level and attribute-level Google suggestions. */
export async function fetchAllGoogleSuggestions(
  connection: GbpConnection,
  profile: GbpLocationProfile
): Promise<GbpGoogleSuggestion[]> {
  const [locationSuggestions, attributeSuggestions] = await Promise.all([
    fetchGoogleSuggestions(connection, profile),
    fetchGoogleAttributeSuggestions(connection, profile),
  ]);

  return [...locationSuggestions, ...attributeSuggestions];
}

/** googleLocations.search — find matching Google locations. */
export async function searchGoogleLocations(
  accessToken: string,
  query: { title: string; address?: string }
): Promise<Array<{ placeId: string; title: string; address: string }>> {
  const res = await fetch(`${BI_BASE}/googleLocations:search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location: {
        title: query.title,
        storefrontAddress: query.address
          ? { addressLines: [query.address], regionCode: "US" }
          : undefined,
      },
    }),
  });

  const data = (await res.json()) as {
    googleLocations?: Array<{
      location?: {
        title?: string;
        storefrontAddress?: { addressLines?: string[]; locality?: string };
        metadata?: { placeId?: string };
      };
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Google location search failed (${res.status})`);
  }

  return (data.googleLocations ?? []).map((item) => {
    const loc = item.location;
    const addr = loc?.storefrontAddress;
    const address = [
      addr?.addressLines?.join(", "),
      addr?.locality,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      placeId: loc?.metadata?.placeId ?? "",
      title: loc?.title ?? "",
      address,
    };
  });
}

/** Resolve enabled attribute labels via getAttributes + metadata display names. */
export async function getGbpEnabledAttributeLabels(
  connection: GbpConnection,
  options?: { profile?: GbpLocationProfile | null }
): Promise<{ labels: string[]; details: GbpLocationAttribute[] }> {
  const profile =
    options?.profile !== undefined
      ? options.profile
      : await getGbpLocationProfile(connection).catch(() => null);

  const [dedicated, available] = await Promise.all([
    getLocationAttributes(connection).catch(() => [] as GbpLocationAttribute[]),
    listAvailableAttributes(connection).catch(() => [] as GbpAttributeMetadata[]),
  ]);

  const details =
    dedicated.length > 0 ? dedicated : (profile?.attributeDetails ?? []);

  const metadataByKey = new Map<string, GbpAttributeMetadata>();
  for (const meta of available) {
    metadataByKey.set(attributeKey(meta.name), meta);
    metadataByKey.set(meta.name, meta);
  }

  const labels: string[] = [];
  for (const attr of details) {
    const label = formatGbpAttributeLabel(attr, metadataByKey);
    if (label) labels.push(label);
  }

  return { labels, details };
}

/** Combined profile + dedicated attributes + Google-updated snapshot. */
export async function getGbpLocationFull(connection: GbpConnection): Promise<{
  profile: GbpLocationProfile;
  attributes: GbpLocationAttribute[];
  availableAttributes: GbpAttributeMetadata[];
  googleUpdated: Record<string, unknown> | null;
}> {
  const profile = await enrichGbpLocationProfile(
    connection,
    await getGbpLocationProfile(connection)
  );

  const [attributeSummary, availableAttributes, googleUpdated] = await Promise.all([
    getGbpEnabledAttributeLabels(connection).catch(() => ({
      labels: profile.attributes,
      details: profile.attributeDetails,
    })),
    listAvailableAttributes(connection).catch(() => [] as GbpAttributeMetadata[]),
    profile.hasGoogleUpdated
      ? getGoogleUpdatedLocation(connection).catch(() => null)
      : Promise.resolve(null),
  ]);

  const enrichedProfile: GbpLocationProfile = {
    ...profile,
    attributes: attributeSummary.labels,
    attributeDetails: attributeSummary.details,
  };

  return {
    profile: enrichedProfile,
    attributes: attributeSummary.details,
    availableAttributes,
    googleUpdated,
  };
}

export async function patchGbpLocation(
  connection: GbpConnection,
  updateMask: string,
  body: Record<string, unknown>,
  validateOnly = false
): Promise<void> {
  const resource = locationResourceName(connection.locationId);
  const url = new URL(`${BI_BASE}/${resource}`);
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

export { normalizeCategoryName, locationResourceName, attributeKey };
