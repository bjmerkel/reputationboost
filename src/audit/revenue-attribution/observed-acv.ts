import { listRevenueTransactionsForBusinessAdmin, updateObservedAcvAdmin } from "./storage-admin";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

const MIN_OBSERVED_ACV_SAMPLES = 5;
const OBSERVED_ACV_LOOKBACK_DAYS = 90;

/** Learn ACV from recent CRM transactions and persist on the business row. */
export async function refreshObservedAcvForBusiness(
  businessId: string
): Promise<{ observedAcv: number | null; sampleSize: number }> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - OBSERVED_ACV_LOOKBACK_DAYS);

  const transactions = await listRevenueTransactionsForBusinessAdmin(businessId, {
    since: since.toISOString(),
  });

  const amounts = transactions
    .map((txn) => txn.amount)
    .filter((amount) => Number.isFinite(amount) && amount > 0);

  const sampleSize = amounts.length;
  const observedAcv =
    sampleSize >= MIN_OBSERVED_ACV_SAMPLES ? Math.round(median(amounts) ?? 0) : null;

  const currency =
    transactions.find((txn) => txn.currency)?.currency ?? "USD";

  await updateObservedAcvAdmin(businessId, observedAcv, sampleSize, currency);

  return { observedAcv, sampleSize };
}

export { MIN_OBSERVED_ACV_SAMPLES };
