import { createClient } from "@/lib/supabase/server";
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

export async function listRevenueTransactionsForUser(
  userId: string,
  businessId: string,
  limit = 50
): Promise<RevenueTransactionRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("revenue_transactions")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapTransactionRow(row as Record<string, unknown>));
}

export async function listKeywordRevenueMonthlyForUser(
  userId: string,
  businessId: string,
  month?: string
): Promise<KeywordRevenueMonthly[]> {
  const supabase = await createClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (!business) return [];

  let query = supabase
    .from("keyword_revenue_monthly")
    .select("*")
    .eq("business_id", businessId)
    .order("observed_revenue", { ascending: false });

  if (month) query = query.eq("month", month);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    businessId: row.business_id as string,
    keyword: row.keyword as string,
    month: row.month as string,
    observedRevenue: Number(row.observed_revenue),
    observedJobs: Number(row.observed_jobs),
    modeledRevenue: row.modeled_revenue == null ? null : Number(row.modeled_revenue),
    avgRank: row.avg_rank == null ? null : Number(row.avg_rank),
    impressions: row.impressions == null ? null : Number(row.impressions),
  }));
}

export async function listGridCellRevenueMonthlyForUser(
  userId: string,
  businessId: string,
  month?: string
): Promise<GridCellRevenueMonthly[]> {
  const supabase = await createClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (!business) return [];

  let query = supabase
    .from("grid_cell_revenue_monthly")
    .select("*")
    .eq("business_id", businessId)
    .order("observed_revenue", { ascending: false });

  if (month) query = query.eq("month", month);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    businessId: row.business_id as string,
    keyword: row.keyword as string,
    gridNorth: Number(row.grid_north),
    gridEast: Number(row.grid_east),
    month: row.month as string,
    observedRevenue: Number(row.observed_revenue),
    observedJobs: Number(row.observed_jobs),
    modeledRevenue: row.modeled_revenue == null ? null : Number(row.modeled_revenue),
    avgRank: row.avg_rank == null ? null : Number(row.avg_rank),
  }));
}

export interface RevenueSummary {
  observedRevenueTotal: number;
  observedJobCount: number;
  observedAcv: number | null;
  observedAcvSampleSize: number;
  transactionCount: number;
  matchedTransactionCount: number;
  currency: string;
}

export async function buildRevenueSummaryForUser(
  userId: string,
  businessId: string,
  periodDays = 90
): Promise<RevenueSummary> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - periodDays);

  const supabase = await createClient();
  const [businessResult, transactionsResult] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "id, observed_avg_customer_value, observed_acv_sample_size, observed_avg_customer_value_currency"
      )
      .eq("id", businessId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("revenue_transactions")
      .select("amount, matched_keyword, currency")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .gte("occurred_at", since.toISOString()),
  ]);

  if (businessResult.error) throw new Error(businessResult.error.message);
  if (transactionsResult.error) throw new Error(transactionsResult.error.message);
  if (!businessResult.data) {
    return {
      observedRevenueTotal: 0,
      observedJobCount: 0,
      observedAcv: null,
      observedAcvSampleSize: 0,
      transactionCount: 0,
      matchedTransactionCount: 0,
      currency: "USD",
    };
  }

  const transactions = transactionsResult.data ?? [];
  const observedRevenueTotal = transactions.reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );
  const matchedTransactionCount = transactions.filter((row) => row.matched_keyword).length;
  const sampleSize = Number(businessResult.data.observed_acv_sample_size ?? 0);
  const observedAcvRaw = businessResult.data.observed_avg_customer_value;

  return {
    observedRevenueTotal,
    observedJobCount: transactions.length,
    observedAcv:
      sampleSize >= 5 && observedAcvRaw != null ? Number(observedAcvRaw) : null,
    observedAcvSampleSize: sampleSize,
    transactionCount: transactions.length,
    matchedTransactionCount,
    currency: (businessResult.data.observed_avg_customer_value_currency as string) ?? "USD",
  };
}
