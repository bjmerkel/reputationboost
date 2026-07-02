import type { ClientConfig } from "../types";
import { collectPlacesRankData } from "@/lib/google/local-rankings";
import { isGoogleMapsConfigured } from "@/lib/google/config";

export { collectPlacesRankData };

export function usesGooglePlacesRankings(): boolean {
  return isGoogleMapsConfigured();
}

/**
 * Combined Google Places collector — one geocode + search pass per keyword/radius.
 * Avoids duplicate API calls when building rankings and competitor snapshots.
 */
export async function collectPlacesSnapshots(client: ClientConfig) {
  return collectPlacesRankData(client);
}
