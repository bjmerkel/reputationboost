import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_PLACES_MONTHLY_CALL_BUDGET = 120;
export const MONTHLY_KEYWORD_CALL_RESERVATION = 29;
const STALE_CLAIM_MS = 2 * 60 * 60 * 1000;

export type MarketCollectionType =
  | "rank_pulse"
  | "monthly_market"
  | "manual_rank_pulse"
  | "event_rank_pulse";

export interface MarketCollectionClaim {
  businessId: string;
  collectionType: MarketCollectionType;
  keyword: string;
  periodStart: string;
}

export function monthStartYmd(date: string | Date): string {
  const value =
    typeof date === "string"
      ? new Date(`${date.slice(0, 10)}T12:00:00.000Z`)
      : date;
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function normalizeCollectionKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface PlacesMonthlyUsage {
  callsBudget: number;
  callsReserved: number;
  callsRemaining: number;
  collectionsSkipped: number;
}

export async function getPlacesMonthlyUsage(
  businessId: string,
  date: string | Date = new Date()
): Promise<PlacesMonthlyUsage> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("places_api_monthly_usage")
    .select("calls_budget,calls_reserved,collections_skipped")
    .eq("business_id", businessId)
    .eq("month", monthStartYmd(date))
    .maybeSingle();
  if (error) throw new Error(`Failed to read Places API budget: ${error.message}`);
  const callsBudget = Number(data?.calls_budget ?? DEFAULT_PLACES_MONTHLY_CALL_BUDGET);
  const callsReserved = Number(data?.calls_reserved ?? 0);
  return {
    callsBudget,
    callsReserved,
    callsRemaining: Math.max(0, callsBudget - callsReserved),
    collectionsSkipped: Number(data?.collections_skipped ?? 0),
  };
}

export async function reservePlacesApiCalls(
  businessId: string,
  date: string,
  calls: number,
  budget = DEFAULT_PLACES_MONTHLY_CALL_BUDGET
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("reserve_places_api_calls", {
    p_business_id: businessId,
    p_month: monthStartYmd(date),
    p_calls: calls,
    p_budget: budget,
  });
  if (error) throw new Error(`Failed to reserve Places API budget: ${error.message}`);
  return data === true;
}

export async function releasePlacesApiCalls(
  businessId: string,
  date: string,
  calls: number
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("release_places_api_calls", {
    p_business_id: businessId,
    p_month: monthStartYmd(date),
    p_calls: calls,
  });
  if (error) throw new Error(`Failed to release Places API budget: ${error.message}`);
}

export async function recordPlacesCollectionSkipped(
  businessId: string,
  date: string
): Promise<void> {
  const supabase = createAdminClient();
  const month = monthStartYmd(date);
  const { data } = await supabase
    .from("places_api_monthly_usage")
    .select("collections_skipped")
    .eq("business_id", businessId)
    .eq("month", month)
    .maybeSingle();
  const { error } = await supabase
    .from("places_api_monthly_usage")
    .upsert(
      {
        business_id: businessId,
        month,
        collections_skipped: Number(data?.collections_skipped ?? 0) + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,month" }
    );
  if (error) throw new Error(`Failed to record skipped Places collection: ${error.message}`);
}

export async function claimMarketCollection(
  claim: MarketCollectionClaim
): Promise<boolean> {
  const supabase = createAdminClient();
  const keyword = normalizeCollectionKeyword(claim.keyword);
  const row = {
    business_id: claim.businessId,
    collection_type: claim.collectionType,
    keyword,
    period_start: claim.periodStart,
    status: "running",
    started_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("market_collection_claims").insert(row);
  if (!error) return true;
  if (error.code !== "23505") {
    throw new Error(`Failed to claim market collection: ${error.message}`);
  }

  const { data: existing, error: readError } = await supabase
    .from("market_collection_claims")
    .select("status,started_at")
    .eq("business_id", claim.businessId)
    .eq("collection_type", claim.collectionType)
    .eq("keyword", keyword)
    .eq("period_start", claim.periodStart)
    .maybeSingle();
  if (readError) throw new Error(`Failed to inspect market collection: ${readError.message}`);
  if (!existing || existing.status === "completed") return false;

  const startedAt = new Date(existing.started_at as string).getTime();
  if (existing.status === "running" && Date.now() - startedAt < STALE_CLAIM_MS) {
    return false;
  }

  const { data: reclaimed, error: updateError } = await supabase
    .from("market_collection_claims")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      completed_at: null,
      error_message: null,
    })
    .eq("business_id", claim.businessId)
    .eq("collection_type", claim.collectionType)
    .eq("keyword", keyword)
    .eq("period_start", claim.periodStart)
    .eq("started_at", existing.started_at)
    .select("business_id")
    .maybeSingle();
  if (updateError) throw new Error(`Failed to reclaim market collection: ${updateError.message}`);
  return Boolean(reclaimed);
}

async function finishMarketCollection(
  claim: MarketCollectionClaim,
  status: "completed" | "failed",
  callsReserved: number,
  errorMessage?: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("market_collection_claims")
    .update({
      status,
      calls_reserved: callsReserved,
      completed_at: new Date().toISOString(),
      error_message: errorMessage ?? null,
    })
    .eq("business_id", claim.businessId)
    .eq("collection_type", claim.collectionType)
    .eq("keyword", normalizeCollectionKeyword(claim.keyword))
    .eq("period_start", claim.periodStart);
  if (error) throw new Error(`Failed to finish market collection: ${error.message}`);
}

export function completeMarketCollection(
  claim: MarketCollectionClaim,
  callsReserved: number
): Promise<void> {
  return finishMarketCollection(claim, "completed", callsReserved);
}

export function failMarketCollection(
  claim: MarketCollectionClaim,
  callsReserved: number,
  error: unknown
): Promise<void> {
  return finishMarketCollection(
    claim,
    "failed",
    callsReserved,
    error instanceof Error ? error.message : String(error)
  );
}
