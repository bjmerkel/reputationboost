import { createAdminClient } from "@/lib/supabase/admin";
import type {
  GridCellRevenueMonthly,
  KeywordRevenueMonthly,
  RevenueTransactionRecord,
} from "./types";

function mapTransactionRow(row: Record<string, unknown>): RevenueTransactionRecord {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    userId: row.user_id as string,
    customerId: (row.customer_id as string | null) ?? null,
    customerEventId: (row.customer_event_id as string | null) ?? null,
    externalId: (row.external_id as string | null) ?? null,
    source: row.source as string,
    eventType: row.event_type as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    occurredAt: row.occurred_at as string,
    matchedKeyword: (row.matched_keyword as string | null) ?? null,
    matchedGridNorth:
      row.matched_grid_north == null ? null : Number(row.matched_grid_north),
    matchedGridEast:
      row.matched_grid_east == null ? null : Number(row.matched_grid_east),
    matchedZone: (row.matched_zone as string | null) ?? null,
    matchMethod: (row.match_method as RevenueTransactionRecord["matchMethod"]) ?? null,
    matchConfidence:
      row.match_confidence == null ? null : Number(row.match_confidence),
    gbpCallMatched: Boolean(row.gbp_call_matched),
    createdAt: row.created_at as string,
  };
}

export interface UpsertRevenueTransactionInput {
  businessId: string;
  userId: string;
  customerId?: string;
  customerEventId?: string;
  externalId?: string;
  source: string;
  eventType: string;
  amount: number;
  currency?: string;
  occurredAt: string;
  matchedKeyword?: string | null;
  matchedGridNorth?: number | null;
  matchedGridEast?: number | null;
  matchedZone?: string | null;
  matchMethod?: string | null;
  matchConfidence?: number | null;
}

export async function upsertRevenueTransactionAdmin(
  input: UpsertRevenueTransactionInput
): Promise<RevenueTransactionRecord | null> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return null;

  const supabase = createAdminClient();
  const row = {
    business_id: input.businessId,
    user_id: input.userId,
    customer_id: input.customerId ?? null,
    customer_event_id: input.customerEventId ?? null,
    external_id: input.externalId ?? null,
    source: input.source,
    event_type: input.eventType,
    amount: input.amount,
    currency: input.currency ?? "USD",
    occurred_at: input.occurredAt,
    matched_keyword: input.matchedKeyword ?? null,
    matched_grid_north: input.matchedGridNorth ?? null,
    matched_grid_east: input.matchedGridEast ?? null,
    matched_zone: input.matchedZone ?? null,
    match_method: input.matchMethod ?? null,
    match_confidence: input.matchConfidence ?? null,
  };

  const { data, error } = input.externalId
    ? await supabase
        .from("revenue_transactions")
        .upsert(row, { onConflict: "business_id,source,external_id" })
        .select("*")
        .single()
    : await supabase.from("revenue_transactions").insert(row).select("*").single();

  if (error) throw new Error(error.message);
  return mapTransactionRow(data as Record<string, unknown>);
}

export async function listRevenueTransactionsForBusinessAdmin(
  businessId: string,
  options?: { limit?: number; since?: string }
): Promise<RevenueTransactionRecord[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("revenue_transactions")
    .select("*")
    .eq("business_id", businessId)
    .order("occurred_at", { ascending: false });

  if (options?.since) {
    query = query.gte("occurred_at", options.since);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapTransactionRow(row as Record<string, unknown>));
}

export async function listUnmatchedRevenueTransactionsAdmin(
  businessId: string,
  limit = 200
): Promise<RevenueTransactionRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("revenue_transactions")
    .select("*")
    .eq("business_id", businessId)
    .is("matched_keyword", null)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapTransactionRow(row as Record<string, unknown>));
}

export async function updateRevenueTransactionMatchAdmin(
  id: string,
  match: {
    matchedKeyword: string | null;
    matchedGridNorth?: number | null;
    matchedGridEast?: number | null;
    matchedZone?: string | null;
    matchMethod?: string | null;
    matchConfidence?: number | null;
  }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("revenue_transactions")
    .update({
      matched_keyword: match.matchedKeyword,
      matched_grid_north: match.matchedGridNorth ?? null,
      matched_grid_east: match.matchedGridEast ?? null,
      matched_zone: match.matchedZone ?? null,
      match_method: match.matchMethod ?? null,
      match_confidence: match.matchConfidence ?? null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

function mapKeywordRevenueRow(row: Record<string, unknown>): KeywordRevenueMonthly {
  return {
    businessId: row.business_id as string,
    keyword: row.keyword as string,
    month: row.month as string,
    observedRevenue: Number(row.observed_revenue),
    observedJobs: Number(row.observed_jobs),
    modeledRevenue: row.modeled_revenue == null ? null : Number(row.modeled_revenue),
    avgRank: row.avg_rank == null ? null : Number(row.avg_rank),
    impressions: row.impressions == null ? null : Number(row.impressions),
  };
}

function mapGridCellRevenueRow(row: Record<string, unknown>): GridCellRevenueMonthly {
  return {
    businessId: row.business_id as string,
    keyword: row.keyword as string,
    gridNorth: Number(row.grid_north),
    gridEast: Number(row.grid_east),
    month: row.month as string,
    observedRevenue: Number(row.observed_revenue),
    observedJobs: Number(row.observed_jobs),
    modeledRevenue: row.modeled_revenue == null ? null : Number(row.modeled_revenue),
    avgRank: row.avg_rank == null ? null : Number(row.avg_rank),
  };
}

export async function upsertKeywordRevenueMonthlyAdmin(
  rows: KeywordRevenueMonthly[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = createAdminClient();
  const { error } = await supabase.from("keyword_revenue_monthly").upsert(
    rows.map((row) => ({
      business_id: row.businessId,
      keyword: row.keyword,
      month: row.month,
      observed_revenue: row.observedRevenue,
      observed_jobs: row.observedJobs,
      modeled_revenue: row.modeledRevenue,
      avg_rank: row.avgRank,
      impressions: row.impressions,
    })),
    { onConflict: "business_id,keyword,month" }
  );
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function upsertGridCellRevenueMonthlyAdmin(
  rows: GridCellRevenueMonthly[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = createAdminClient();
  const { error } = await supabase.from("grid_cell_revenue_monthly").upsert(
    rows.map((row) => ({
      business_id: row.businessId,
      keyword: row.keyword,
      grid_north: row.gridNorth,
      grid_east: row.gridEast,
      month: row.month,
      observed_revenue: row.observedRevenue,
      observed_jobs: row.observedJobs,
      modeled_revenue: row.modeledRevenue,
      avg_rank: row.avgRank,
    })),
    { onConflict: "business_id,keyword,grid_north,grid_east,month" }
  );
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function listKeywordRevenueMonthlyForBusiness(
  userId: string,
  businessId: string,
  month?: string
): Promise<KeywordRevenueMonthly[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("keyword_revenue_monthly")
    .select("*, businesses!inner(user_id)")
    .eq("business_id", businessId)
    .eq("businesses.user_id", userId)
    .order("observed_revenue", { ascending: false });

  if (month) query = query.eq("month", month);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapKeywordRevenueRow(row as Record<string, unknown>));
}

export async function listGridCellRevenueMonthlyForBusiness(
  userId: string,
  businessId: string,
  month?: string
): Promise<GridCellRevenueMonthly[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("grid_cell_revenue_monthly")
    .select("*, businesses!inner(user_id)")
    .eq("business_id", businessId)
    .eq("businesses.user_id", userId)
    .order("observed_revenue", { ascending: false });

  if (month) query = query.eq("month", month);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapGridCellRevenueRow(row as Record<string, unknown>));
}

export async function updateObservedAcvAdmin(
  businessId: string,
  observedAcv: number | null,
  sampleSize: number,
  currency = "USD"
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      observed_avg_customer_value: observedAcv,
      observed_avg_customer_value_currency: currency,
      observed_acv_sample_size: sampleSize,
      observed_acv_updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (error) throw new Error(error.message);
}
