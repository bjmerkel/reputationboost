import type { ClientConfig } from "../types";
import { loadFreshKeywordGridAdmin } from "@/audit/storage-grid-snapshots";
import { collectPlacesRankData } from "@/lib/google/local-rankings";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";

export { collectPlacesRankData };

export function usesGooglePlacesRankings(): boolean {
  return isGoogleMapsConfigured();
}

/**
 * Combined Google Places collector — one geocode + search pass per keyword/radius.
 * Avoids duplicate API calls when building rankings and competitor snapshots.
 */
export async function collectPlacesSnapshots(client: ClientConfig) {
  return collectPlacesRankData(client, {
    resolveStoredGrid: async (keyword) => {
      if (!client.id || client.id === "preview") return null;
      return loadFreshKeywordGridAdmin(
        client.id,
        keyword,
        HEATMAP_FLAGS.auditReuseWeeklyGridDays
      );
    },
  });
}
