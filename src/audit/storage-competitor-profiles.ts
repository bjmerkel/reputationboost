import type { CompetitorProfile, CompetitorSnapshot } from "@/audit/types";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CompetitorProfileSnapshotRow {
  businessId: string;
  keyword: string;
  placeId: string;
  collectedAt: string;
  source: "audit" | "grid" | "leader_enrichment";
  profile: CompetitorProfile;
}

function snapshotProfiles(snapshot: CompetitorSnapshot): CompetitorProfile[] {
  const byPlace = new Map<string, CompetitorProfile>();
  const profiles = [
    ...snapshot.localPack,
    ...snapshot.widerRadius.flatMap((tier) => tier.competitors),
    ...snapshot.textSearchFallback,
    ...snapshot.competitors,
  ];

  for (const profile of profiles) {
    if (!profile.placeId) continue;
    const existing = byPlace.get(profile.placeId);
    if (!existing || profile.reviewCount > existing.reviewCount) {
      byPlace.set(profile.placeId, profile);
    }
  }

  return [...byPlace.values()];
}

/** Persist competitor profiles from an audit or grid collection. */
export async function upsertCompetitorProfileSnapshots(params: {
  businessId: string;
  snapshots: CompetitorSnapshot[];
  source: CompetitorProfileSnapshotRow["source"];
}): Promise<number> {
  const rows: CompetitorProfileSnapshotRow[] = [];

  for (const snapshot of params.snapshots) {
    const collectedAt = snapshot.collectedAt;
    for (const profile of snapshotProfiles(snapshot)) {
      rows.push({
        businessId: params.businessId,
        keyword: snapshot.keyword,
        placeId: profile.placeId,
        collectedAt,
        source: params.source,
        profile,
      });
    }
  }

  if (rows.length === 0) return 0;

  const supabase = createAdminClient();
  const { error } = await supabase.from("competitor_profile_snapshots").upsert(
    rows.map((row) => ({
      business_id: row.businessId,
      keyword: row.keyword,
      place_id: row.placeId,
      collected_at: row.collectedAt,
      source: row.source,
      profile: row.profile,
    })),
    { onConflict: "business_id,keyword,place_id,collected_at" }
  );

  if (error) {
    throw new Error(`Failed to upsert competitor_profile_snapshots: ${error.message}`);
  }

  return rows.length;
}

export async function loadCompetitorProfilesForKeywordAdmin(
  businessId: string,
  keyword: string,
  limit = 20
): Promise<CompetitorProfile[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("competitor_profile_snapshots")
    .select("place_id, profile, collected_at")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .order("collected_at", { ascending: false })
    .limit(limit * 3);

  if (error || !data) return [];

  const byPlace = new Map<string, CompetitorProfile>();
  for (const row of data) {
    const placeId = row.place_id as string;
    if (byPlace.has(placeId)) continue;
    byPlace.set(placeId, row.profile as CompetitorProfile);
    if (byPlace.size >= limit) break;
  }

  return [...byPlace.values()];
}
