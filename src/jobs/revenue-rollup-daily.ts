import { listOnboardedBusinesses } from "@/audit/businesses-admin";
import type { BusinessRecord } from "@/audit/businesses";
import { rollupRevenueForBusiness, type RevenueRollupResult } from "@/audit/revenue-attribution/rollup";

export interface RevenueRollupRunResult {
  businessesProcessed: number;
  keywordRowsUpserted: number;
  gridRowsUpserted: number;
  rematchedTransactions: number;
  errors: Array<{ businessId: string; message: string }>;
}

export async function rollupRevenueDaily(): Promise<RevenueRollupRunResult> {
  const businesses = await listOnboardedBusinesses();
  const result: RevenueRollupRunResult = {
    businessesProcessed: 0,
    keywordRowsUpserted: 0,
    gridRowsUpserted: 0,
    rematchedTransactions: 0,
    errors: [],
  };

  for (const business of businesses) {
    try {
      const rollup: RevenueRollupResult = await rollupRevenueForBusiness(business);
      result.businessesProcessed += 1;
      result.keywordRowsUpserted += rollup.keywordRows;
      result.gridRowsUpserted += rollup.gridRows;
      result.rematchedTransactions += rollup.rematched;
    } catch (error) {
      result.errors.push({
        businessId: business.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export async function rollupRevenueForOnboardedBusiness(
  business: BusinessRecord
): Promise<RevenueRollupResult> {
  return rollupRevenueForBusiness(business);
}
