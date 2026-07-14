import type { PlaceResult } from "./places";
import { isAdminSupabaseConfigured, createAdminClient } from "@/lib/supabase/admin";

export async function getPersistentPlacesSearch(
  cacheKey: string
): Promise<PlaceResult[] | null> {
  if (!isAdminSupabaseConfigured()) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("places_search_cache")
      .select("results,hit_count")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !Array.isArray(data?.results)) return null;

    await supabase
      .from("places_search_cache")
      .update({ hit_count: Number(data.hit_count ?? 0) + 1 })
      .eq("cache_key", cacheKey);
    return data.results as unknown as PlaceResult[];
  } catch {
    return null;
  }
}

export async function setPersistentPlacesSearch(
  cacheKey: string,
  mode: "nearby" | "text",
  results: PlaceResult[],
  ttlMs: number
): Promise<void> {
  if (!isAdminSupabaseConfigured()) return;
  try {
    const now = new Date();
    const supabase = createAdminClient();
    await supabase.from("places_search_cache").upsert(
      {
        cache_key: cacheKey,
        search_mode: mode,
        results,
        fetched_at: now.toISOString(),
        expires_at: new Date(now.getTime() + ttlMs).toISOString(),
      },
      { onConflict: "cache_key" }
    );
  } catch {
    // Cache persistence must never break a rank collection.
  }
}
