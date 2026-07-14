import { getGoogleMapsApiKey } from "./config";
import {
  getCachedPlacesSearch,
  PLACES_SEARCH_CACHE_TTL_MS,
  placesSearchCacheKey,
  setCachedPlacesSearch,
} from "./places-cache";
import {
  getPersistentPlacesSearch,
  setPersistentPlacesSearch,
} from "./places-cache-store";

const METERS_PER_MILE = 1609.34;
/** Rank tracking only needs the first page (top ~20 results). */
const DEFAULT_NEARBY_MAX_PAGES = 1;
const MAX_NEARBY_PAGES = 3;
const PAGE_TOKEN_DELAY_MS = 2000;
const NEARBY_SEARCH_MAX_RETRIES = 3;
const TRANSIENT_NEARBY_STATUSES = new Set(["UNKNOWN_ERROR", "OVER_QUERY_LIMIT"]);

export const SEARCH_RADII_MILES = [1, 3, 5, 10] as const;

export type SearchRadiusMiles = (typeof SEARCH_RADII_MILES)[number];

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface PlaceResult {
  placeId: string;
  name: string;
  rating: number | null;
  reviewCount: number;
  address: string;
  types: string[];
  lat?: number;
  lng?: number;
  /** 1-indexed position in the ordered Google result list */
  position: number;
}

interface GoogleGeocodeResponse {
  status: string;
  results?: Array<{
    geometry: { location: { lat: number; lng: number } };
  }>;
  error_message?: string;
}

interface GooglePlacesSearchResponse {
  status: string;
  results?: Array<{
    place_id: string;
    name: string;
    rating?: number;
    user_ratings_total?: number;
    vicinity?: string;
    formatted_address?: string;
    types?: string[];
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
  next_page_token?: string;
  error_message?: string;
}

interface PlacesTextSearchNewResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    location?: { latitude?: number; longitude?: number };
  }>;
  nextPageToken?: string;
  error?: { message?: string; status?: string };
}

function apiKeyOrThrow(): string {
  const key = getGoogleMapsApiKey();
  if (!key) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured.");
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function milesToMeters(miles: number): number {
  return Math.round(miles * METERS_PER_MILE);
}

/**
 * Geocode a street address to lat/lng via Google Geocoding API.
 */
export async function geocodeAddress(address: string): Promise<GeoLocation> {
  const key = apiKeyOrThrow();
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  const data = (await res.json()) as GoogleGeocodeResponse;

  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error(
      `Geocoding failed for "${address}": ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`
    );
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

/** Geocode a Google place ID (region or address) to lat/lng; returns null on failure. */
export async function geocodePlaceId(placeId: string): Promise<GeoLocation | null> {
  if (!placeId.trim()) return null;

  try {
    const key = apiKeyOrThrow();
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("key", key);

    const res = await fetch(url.toString());
    const data = (await res.json()) as GoogleGeocodeResponse;

    if (data.status !== "OK" || !data.results?.[0]) {
      return null;
    }

    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Resolve a GBP service-area place by ID first, then by display name. */
export async function resolveServiceAreaPlace(
  placeId: string,
  placeName: string
): Promise<GeoLocation | null> {
  const byId = await geocodePlaceId(placeId);
  if (byId) return byId;

  try {
    return await geocodeAddress(placeName);
  } catch {
    return null;
  }
}

export function mapPlaceResult(
  raw: NonNullable<GooglePlacesSearchResponse["results"]>[number],
  position: number
): PlaceResult {
  return {
    placeId: raw.place_id,
    name: raw.name,
    rating: raw.rating ?? null,
    reviewCount: raw.user_ratings_total ?? 0,
    address: raw.vicinity ?? raw.formatted_address ?? "",
    types: raw.types ?? [],
    lat: raw.geometry?.location?.lat,
    lng: raw.geometry?.location?.lng,
    position,
  };
}

async function fetchNearbySearchResponse(url: URL): Promise<GooglePlacesSearchResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < NEARBY_SEARCH_MAX_RETRIES; attempt++) {
    const res = await fetch(url.toString());
    let data: GooglePlacesSearchResponse;

    try {
      data = (await res.json()) as GooglePlacesSearchResponse;
    } catch {
      lastError = new Error(`Places Nearby Search returned invalid JSON (HTTP ${res.status})`);
      if (res.status >= 500 && attempt < NEARBY_SEARCH_MAX_RETRIES - 1) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw lastError;
    }

    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      return data;
    }

    lastError = new Error(
      `Places Nearby Search failed: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`
    );

    const transient =
      TRANSIENT_NEARBY_STATUSES.has(data.status) || res.status >= 500 || data.status === "INTERNAL_ERROR";

    if (transient && attempt < NEARBY_SEARCH_MAX_RETRIES - 1) {
      const delay =
        data.status === "OVER_QUERY_LIMIT" ? PAGE_TOKEN_DELAY_MS * (attempt + 1) : 1000 * (attempt + 1);
      await sleep(delay);
      continue;
    }

    throw lastError;
  }

  throw lastError ?? new Error("Places Nearby Search failed");
}

export interface NearbySearchOptions {
  /** Result pages to fetch (20 results each). Rank checks default to 1. */
  maxPages?: number;
  /** Bypass the in-memory read-through cache. */
  skipCache?: boolean;
}

/**
 * Places Nearby Search — primary ranking flow.
 * Defaults to a single page; pass maxPages up to 3 for deeper result lists.
 */
export async function nearbySearch(
  keyword: string,
  location: GeoLocation,
  radiusMeters: number,
  options: NearbySearchOptions = {}
): Promise<PlaceResult[]> {
  const maxPages = Math.min(
    Math.max(options.maxPages ?? DEFAULT_NEARBY_MAX_PAGES, 1),
    MAX_NEARBY_PAGES
  );
  const cacheKey = placesSearchCacheKey(
    keyword,
    location.lat,
    location.lng,
    radiusMeters,
    `nearby:${maxPages}`
  );

  if (!options.skipCache) {
    const cached = getCachedPlacesSearch(cacheKey);
    if (cached) return cached;
    const persistent = await getPersistentPlacesSearch(cacheKey);
    if (persistent) {
      setCachedPlacesSearch(cacheKey, persistent);
      return persistent;
    }
  }

  const key = apiKeyOrThrow();
  const locationString = `${location.lat},${location.lng}`;
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", locationString);
    url.searchParams.set("radius", String(radiusMeters));
    url.searchParams.set("keyword", keyword);
    url.searchParams.set("key", key);

    if (pageToken) {
      await sleep(PAGE_TOKEN_DELAY_MS);
      url.searchParams.set("pagetoken", pageToken);
    }

    const data = await fetchNearbySearchResponse(url);

    const pageResults = data.results ?? [];
    for (const place of pageResults) {
      results.push(mapPlaceResult(place, results.length + 1));
    }

    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }

  if (!options.skipCache) {
    setCachedPlacesSearch(cacheKey, results);
    await setPersistentPlacesSearch(
      cacheKey,
      "nearby",
      results,
      PLACES_SEARCH_CACHE_TTL_MS
    );
  }

  return results;
}

/**
 * Places Text Search — alternate ordering (CRM / legacy RankTracker flow).
 * Nearby and Text Search can return different orderings for the same keyword.
 */
function normalizePlaceId(id: string): string {
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

function mapNewTextSearchPlace(
  raw: NonNullable<PlacesTextSearchNewResponse["places"]>[number],
  position: number
): PlaceResult | null {
  const placeId = raw.id ? normalizePlaceId(raw.id) : "";
  const name = raw.displayName?.text?.trim();
  if (!placeId || !name) return null;

  return {
    placeId,
    name,
    rating: raw.rating ?? null,
    reviewCount: raw.userRatingCount ?? 0,
    address: raw.formattedAddress ?? "",
    types: raw.types ?? [],
    lat: raw.location?.latitude,
    lng: raw.location?.longitude,
    position,
  };
}

async function textSearchNew(
  keyword: string,
  location: GeoLocation,
  radiusMeters: number,
  options: { maxPages?: number; rankFieldsOnly?: boolean } = {}
): Promise<PlaceResult[]> {
  const key = apiKeyOrThrow();
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;
  const radius = Math.min(Math.max(radiusMeters, 1), 50000);
  const maxPages = Math.min(Math.max(options.maxPages ?? MAX_NEARBY_PAGES, 1), MAX_NEARBY_PAGES);

  for (let page = 0; page < maxPages; page++) {
    const body: Record<string, unknown> = {
      textQuery: keyword,
      pageSize: 20,
      locationBias: {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius,
        },
      },
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": options.rankFieldsOnly
          ? "places.id,places.displayName,nextPageToken"
          : "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.location,nextPageToken",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as PlacesTextSearchNewResponse;
    if (!res.ok) {
      const message = data.error?.message ?? res.statusText;
      throw new Error(
        `Places Text Search (New) failed for "${keyword}": ${data.error?.status ?? res.status}${message ? ` — ${message}` : ""}`
      );
    }

    const pageResults = data.places ?? [];
    for (const place of pageResults) {
      const mapped = mapNewTextSearchPlace(place, results.length + 1);
      if (mapped) results.push(mapped);
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
    if (page < maxPages - 1) {
      await sleep(PAGE_TOKEN_DELAY_MS);
    }
  }

  return results;
}

async function textSearchLegacy(
  keyword: string,
  location: GeoLocation,
  radiusMeters: number,
  maxPages = MAX_NEARBY_PAGES
): Promise<PlaceResult[]> {
  const key = apiKeyOrThrow();
  const locationString = `${location.lat},${location.lng}`;
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < Math.min(Math.max(maxPages, 1), MAX_NEARBY_PAGES); page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("query", keyword);
    url.searchParams.set("location", locationString);
    url.searchParams.set("radius", String(radiusMeters));
    url.searchParams.set("key", key);

    if (pageToken) {
      await sleep(PAGE_TOKEN_DELAY_MS);
      url.searchParams.set("pagetoken", pageToken);
    }

    const res = await fetch(url.toString());
    const data = (await res.json()) as GooglePlacesSearchResponse;

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(
        `Places Text Search failed for "${keyword}": ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`
      );
    }

    const pageResults = data.results ?? [];
    for (const place of pageResults) {
      results.push(mapPlaceResult(place, results.length + 1));
    }

    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }

  return results;
}

export async function textSearch(
  keyword: string,
  location: GeoLocation,
  radiusMeters: number,
  options: {
    maxPages?: number;
    rankFieldsOnly?: boolean;
    allowLegacyFallback?: boolean;
  } = {}
): Promise<PlaceResult[]> {
  const cacheKey = placesSearchCacheKey(
    keyword,
    location.lat,
    location.lng,
    radiusMeters,
    `text:${options.maxPages ?? MAX_NEARBY_PAGES}:${options.rankFieldsOnly ? "rank" : "full"}:${options.allowLegacyFallback === false ? "new-only" : "fallback"}`
  );
  const cached = getCachedPlacesSearch(cacheKey);
  if (cached) return cached;
  const persistent = await getPersistentPlacesSearch(cacheKey);
  if (persistent) {
    setCachedPlacesSearch(cacheKey, persistent);
    return persistent;
  }

  let results: PlaceResult[];
  try {
    results = await textSearchNew(keyword, location, radiusMeters, options);
  } catch (error) {
    if (options.allowLegacyFallback === false) throw error;
    results = await textSearchLegacy(keyword, location, radiusMeters, options.maxPages);
  }
  setCachedPlacesSearch(cacheKey, results);
  await setPersistentPlacesSearch(
    cacheKey,
    "text",
    results,
    PLACES_SEARCH_CACHE_TTL_MS
  );
  return results;
}

export type PlacesSearchMode = "nearby" | "text";

export interface SearchPlacesOptions {
  /** Override the Text Search query string (Nearby Search always uses keyword). */
  textQuery?: string;
  /** Result pages to fetch. Nearby defaults to 1; Text Search defaults to 3. */
  maxPages?: number;
  /** Text Search only — request only Place ID and display name to control SKU cost. */
  rankFieldsOnly?: boolean;
  /** Text Search only — fail instead of mixing legacy ordering into a New API scan. */
  allowLegacyFallback?: boolean;
  /** Nearby Search only — skip read-through cache. */
  skipCache?: boolean;
}

export async function searchPlaces(
  keyword: string,
  location: GeoLocation,
  radiusMeters: number,
  mode: PlacesSearchMode = "nearby",
  options?: SearchPlacesOptions
): Promise<PlaceResult[]> {
  return mode === "text"
    ? textSearch(options?.textQuery ?? keyword, location, radiusMeters, {
        maxPages: options?.maxPages,
        rankFieldsOnly: options?.rankFieldsOnly,
        allowLegacyFallback: options?.allowLegacyFallback,
      })
    : nearbySearch(keyword, location, radiusMeters, {
        maxPages: options?.maxPages,
        skipCache: options?.skipCache,
      });
}

/** Like searchPlaces but returns an empty list instead of failing the caller. */
export async function searchPlacesSafe(
  keyword: string,
  location: GeoLocation,
  radiusMeters: number,
  mode: PlacesSearchMode = "nearby",
  options?: SearchPlacesOptions
): Promise<PlaceResult[]> {
  try {
    return await searchPlaces(keyword, location, radiusMeters, mode, options);
  } catch {
    return [];
  }
}
