import type { ClientConfig } from "../types";
import { loadFreshKeywordGridAdmin } from "@/audit/storage-grid-snapshots";
import { collectPlacesRankData } from "@/lib/google/local-rankings";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";

export { collectPlacesRankData };

export function usesGooglePlacesRankings(): boolean {
  return isGoogleMapsConfigured();
}

export function gridStorageBusinessId(client: ClientConfig): string | null {
  if (client.id === "preview") return null;
  return client.businessId ?? null;
}

/**
 * Combined Google Places collector — one geocode + search pass per keyword/radius.
 * Avoids duplicate API calls when building rankings and competitor snapshots.
 */
export async function collectPlacesSnapshots(client: ClientConfig) {
  return collectPlacesRankData(client, {
    resolveStoredGrid: async (keyword) => {
      const businessId = gridStorageBusinessId(client);
      if (!businessId) return null;
      return loadFreshKeywordGridAdmin(
        businessId,
        keyword,
        HEATMAP_FLAGS.auditReuseWeeklyGridDays
      );
    },
  });
}
