import type { CompletedTaskRecord } from "@/audit/storage-attribution";
import { businessRecordToClientConfig, type BusinessRecord } from "@/audit/businesses";
import {
  persistKeywordGridFromCollection,
  shouldRefreshGridAfterTask,
} from "@/audit/storage-grid-snapshots";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { collectKeywordGeoGrid } from "@/lib/google/geo-grid";
import {
  resolveBusinessLocation,
  type BusinessMatchOptions,
} from "@/lib/google/local-rankings";
import { createAdminClient } from "@/lib/supabase/admin";
import { gridProfileForCollection } from "@/lib/feature-flags";

async function loadBusinessClient(businessId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (!data) return null;
  return businessRecordToClientConfig(data as BusinessRecord);
}

/** Refresh full geo grid after a completed task when ranks improved (debounced). */
export async function refreshGridAfterTaskIfNeeded(
  record: CompletedTaskRecord,
  options: {
    primaryKeyword: string | null;
    rankImproved: boolean;
    taskId: string;
  }
): Promise<void> {
  const { primaryKeyword, rankImproved, taskId } = options;
  if (!primaryKeyword || !rankImproved) return;
  if (!isGoogleMapsConfigured()) return;

  const shouldRefresh = await shouldRefreshGridAfterTask(record.businessId, primaryKeyword);
  if (!shouldRefresh) return;

  const client = await loadBusinessClient(record.businessId);
  if (!client) return;

  const location = await resolveBusinessLocation(client);
  const matchOptions: BusinessMatchOptions = {
    businessName: client.name,
    placeId: client.gbpPlaceId,
    businessAddress: [
      client.location.address,
      client.location.city,
      client.location.state,
      client.location.zip,
    ]
      .filter(Boolean)
      .join(", "),
  };

  const geoGrid = await collectKeywordGeoGrid(primaryKeyword, location, matchOptions, {
    profile: gridProfileForCollection("task_trigger"),
    includeLocalPack: true,
  });
  await persistKeywordGridFromCollection(
    record.businessId,
    primaryKeyword,
    geoGrid,
    "task_trigger",
    taskId
  );
}
