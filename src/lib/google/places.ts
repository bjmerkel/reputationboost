import { getGoogleMapsApiKey } from "./config";

const METERS_PER_MILE = 1609.34;
const MAX_NEARBY_PAGES = 3;
const PAGE_TOKEN_DELAY_MS = 2000;

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

function mapPlaceResult(
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
    position,
  };
}

/**
 * Places Nearby Search — primary ranking flow.
 * Paginates up to 3 pages (~60 results) to find businesses beyond the first 20.
 */
export async function nearbySearch(
  keyword: string,
  location: GeoLocation,
  radiusMeters: number
): Promise<PlaceResult[]> {
  const key = apiKeyOrThrow();
  const locationString = `${location.lat},${location.lng}`;
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_NEARBY_PAGES; page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", locationString);
    url.searchParams.set("radius", String(radiusMeters));
    url.searchParams.set("keyword", keyword);
    url.searchParams.set("key", key);

    if (pageToken) {
      await sleep(PAGE_TOKEN_DELAY_MS);
      url.searchParams.set("pagetoken", pageToken);
    }

    const res = await fetch(url.toString());
    const data = (await res.json()) as GooglePlacesSearchResponse;

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(
        `Places Nearby Search failed for "${keyword}": ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`
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
    position,
  };
}

async function textSearchNew(
  keyword: string,
  location: GeoLocation,
  radiusMeters: number
): Promise<PlaceResult[]> {
  const key = apiKeyOrThrow();
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;
  const radius = Math.min(Math.max(radiusMeters, 1), 50000);

  for (let page = 0; page < MAX_NEARBY_PAGES; page++) {
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
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,nextPageToken",
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
    if (page < MAX_NEARBY_PAGES - 1) {
      await sleep(PAGE_TOKEN_DELAY_MS);
    }
  }

  return results;
}

async function textSearchLegacy(
  keyword: string,
  location: GeoLocation,
  radiusMeters: number
): Promise<PlaceResult[]> {
  const key = apiKeyOrThrow();
  const locationString = `${location.lat},${location.lng}`;
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_NEARBY_PAGES; page++) {
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
  radiusMeters: number
): Promise<PlaceResult[]> {
  try {
    return await textSearchNew(keyword, location, radiusMeters);
  } catch {
    return textSearchLegacy(keyword, location, radiusMeters);
  }
}

export type PlacesSearchMode = "nearby" | "text";

export interface SearchPlacesOptions {
  /** Override the Text Search query string (Nearby Search always uses keyword). */
  textQuery?: string;
}

export async function searchPlaces(
  keyword: string,
  location: GeoLocation,
  radiusMeters: number,
  mode: PlacesSearchMode = "nearby",
  options?: SearchPlacesOptions
): Promise<PlaceResult[]> {
  return mode === "text"
    ? textSearch(options?.textQuery ?? keyword, location, radiusMeters)
    : nearbySearch(keyword, location, radiusMeters);
}
