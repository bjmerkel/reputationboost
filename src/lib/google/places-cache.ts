import type { PlaceResult } from "./places";

interface CacheEntry {
  results: PlaceResult[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Dedupe identical Nearby Search requests within a warm server instance. */
export const PLACES_SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function placesSearchCacheKey(
  keyword: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  namespace = "nearby"
): string {
  const latKey = lat.toFixed(4);
  const lngKey = lng.toFixed(4);
  return `${namespace}:${keyword.toLowerCase().trim()}:${latKey}:${lngKey}:${radiusMeters}`;
}

export function getCachedPlacesSearch(key: string): PlaceResult[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.results;
}

export function setCachedPlacesSearch(key: string, results: PlaceResult[]): void {
  cache.set(key, { results, expiresAt: Date.now() + PLACES_SEARCH_CACHE_TTL_MS });
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < 100; i++) {
      cache.delete(oldest[i]![0]);
    }
  }
}
