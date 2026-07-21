import { createAdminClient } from "@/lib/supabase/admin";
import { cellRevenueKey } from "./match-cell";
import type { RevenueContext } from "./types";

function monthStart(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Load observed revenue context for plan/autopilot prioritization. */
export async function loadRevenueContextForBusiness(
  businessId: string
): Promise<RevenueContext> {
  const supabase = createAdminClient();
  const month = monthStart(new Date());

  const [keywordResult, gridResult, businessResult] = await Promise.all([
    supabase
      .from("keyword_revenue_monthly")
      .select("keyword, observed_revenue, observed_jobs")
      .eq("business_id", businessId)
      .eq("month", month),
    supabase
      .from("grid_cell_revenue_monthly")
      .select("keyword, grid_north, grid_east, observed_revenue")
      .eq("business_id", businessId)
      .eq("month", month),
    supabase
      .from("businesses")
      .select("observed_avg_customer_value, observed_acv_sample_size")
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  if (keywordResult.error) throw new Error(keywordResult.error.message);
  if (gridResult.error) throw new Error(gridResult.error.message);
  if (businessResult.error) throw new Error(businessResult.error.message);

  const keywordObservedRevenue = new Map<string, number>();
  let observedRevenueTotal = 0;
  let observedJobCount = 0;

  for (const row of keywordResult.data ?? []) {
    const revenue = Number(row.observed_revenue);
    const jobs = Number(row.observed_jobs);
    keywordObservedRevenue.set(String(row.keyword).toLowerCase(), revenue);
    observedRevenueTotal += revenue;
    observedJobCount += jobs;
  }

  const cellObservedRevenue = new Map<string, number>();
  for (const row of gridResult.data ?? []) {
    const revenue = Number(row.observed_revenue);
    cellObservedRevenue.set(
      cellRevenueKey(String(row.keyword), Number(row.grid_north), Number(row.grid_east)),
      revenue
    );
  }

  const sampleSize = Number(businessResult.data?.observed_acv_sample_size ?? 0);
  const observedAcvRaw = businessResult.data?.observed_avg_customer_value;
  const observedAcv =
    sampleSize >= 5 && observedAcvRaw != null ? Number(observedAcvRaw) : null;

  return {
    observedJobCount,
    observedRevenueTotal,
    observedAcv,
    keywordObservedRevenue,
    cellObservedRevenue,
  };
}

export function observedRevenueForKeyword(
  context: RevenueContext | undefined,
  keyword: string
): number {
  if (!context) return 0;
  return context.keywordObservedRevenue.get(keyword.toLowerCase()) ?? 0;
}

export function observedRevenueForCell(
  context: RevenueContext | undefined,
  keyword: string,
  gridNorth: number,
  gridEast: number
): number {
  if (!context) return 0;
  return context.cellObservedRevenue.get(cellRevenueKey(keyword, gridNorth, gridEast)) ?? 0;
}
