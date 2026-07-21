import type { BusinessRecord } from "@/audit/businesses";
import { businessRecordToClientConfig } from "@/audit/businesses";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWebhookServiceRaw } from "@/lib/integrations/webhook-service";
import { matchTransactionToCell } from "./match-cell";
import { matchTransactionToKeyword } from "./match-keyword";
import { refreshObservedAcvForBusiness } from "./observed-acv";
import {
  listRevenueTransactionsForBusinessAdmin,
  listUnmatchedRevenueTransactionsAdmin,
  updateRevenueTransactionMatchAdmin,
  upsertGridCellRevenueMonthlyAdmin,
  upsertKeywordRevenueMonthlyAdmin,
} from "./storage-admin";
import type { GridCellRevenueMonthly, KeywordRevenueMonthly } from "./types";

function monthStart(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function loadCustomerEventPayload(
  customerEventId: string | null
): Promise<Record<string, unknown> | null> {
  if (!customerEventId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_events")
    .select("payload")
    .eq("id", customerEventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const payload = data?.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
}

async function rematchUnmatchedTransactionsForBusiness(
  business: BusinessRecord
): Promise<number> {
  const auditRaw = await loadLatestAuditForBusinessAdmin(
    business.user_id,
    business.id,
    business.slug,
    business.name
  );
  const audit = auditRaw ? ensureStrategy(auditRaw) : null;
  const client = businessRecordToClientConfig(business);
  const unmatched = await listUnmatchedRevenueTransactionsAdmin(business.id);

  let updated = 0;
  for (const txn of unmatched) {
    const payload = await loadCustomerEventPayload(txn.customerEventId);
    const serviceText = payload ? resolveWebhookServiceRaw(payload) : undefined;
    const keywordMatch = matchTransactionToKeyword(serviceText, audit);
    if (!keywordMatch.keyword) continue;

    const jobLat =
      typeof payload?.jobLat === "number"
        ? payload.jobLat
        : typeof payload?.job_lat === "number"
          ? payload.job_lat
          : undefined;
    const jobLng =
      typeof payload?.jobLng === "number"
        ? payload.jobLng
        : typeof payload?.job_lng === "number"
          ? payload.job_lng
          : undefined;

    const cellMatch = matchTransactionToCell({ jobLat, jobLng }, client);

    await updateRevenueTransactionMatchAdmin(txn.id, {
      matchedKeyword: keywordMatch.keyword,
      matchedGridNorth: txn.matchedGridNorth ?? cellMatch.gridNorth,
      matchedGridEast: txn.matchedGridEast ?? cellMatch.gridEast,
      matchedZone: txn.matchedZone ?? cellMatch.zone,
      matchMethod: keywordMatch.method,
      matchConfidence: keywordMatch.confidence,
    });
    updated += 1;
  }

  return updated;
}

function buildKeywordRollups(
  businessId: string,
  transactions: Awaited<ReturnType<typeof listRevenueTransactionsForBusinessAdmin>>
): KeywordRevenueMonthly[] {
  const byKey = new Map<string, KeywordRevenueMonthly>();

  for (const txn of transactions) {
    if (!txn.matchedKeyword) continue;
    const month = monthStart(new Date(txn.occurredAt));
    const key = `${txn.matchedKeyword.toLowerCase()}|${month}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.observedRevenue += txn.amount;
      existing.observedJobs += 1;
    } else {
      byKey.set(key, {
        businessId,
        keyword: txn.matchedKeyword,
        month,
        observedRevenue: txn.amount,
        observedJobs: 1,
        modeledRevenue: null,
        avgRank: null,
        impressions: null,
      });
    }
  }

  return [...byKey.values()];
}

function buildGridCellRollups(
  businessId: string,
  transactions: Awaited<ReturnType<typeof listRevenueTransactionsForBusinessAdmin>>
): GridCellRevenueMonthly[] {
  const byKey = new Map<string, GridCellRevenueMonthly>();

  for (const txn of transactions) {
    if (
      !txn.matchedKeyword ||
      txn.matchedGridNorth == null ||
      txn.matchedGridEast == null
    ) {
      continue;
    }

    const month = monthStart(new Date(txn.occurredAt));
    const key = `${txn.matchedKeyword.toLowerCase()}|${txn.matchedGridNorth}|${txn.matchedGridEast}|${month}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.observedRevenue += txn.amount;
      existing.observedJobs += 1;
    } else {
      byKey.set(key, {
        businessId,
        keyword: txn.matchedKeyword,
        gridNorth: txn.matchedGridNorth,
        gridEast: txn.matchedGridEast,
        month,
        observedRevenue: txn.amount,
        observedJobs: 1,
        modeledRevenue: null,
        avgRank: null,
      });
    }
  }

  return [...byKey.values()];
}

export interface RevenueRollupResult {
  keywordRows: number;
  gridRows: number;
  rematched: number;
  observedAcv: number | null;
  sampleSize: number;
}

/** Re-match, roll up keyword/cell revenue, and refresh observed ACV for one business. */
export async function rollupRevenueForBusiness(
  business: BusinessRecord
): Promise<RevenueRollupResult> {
  const rematched = await rematchUnmatchedTransactionsForBusiness(business);

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 13);

  const transactions = await listRevenueTransactionsForBusinessAdmin(business.id, {
    since: since.toISOString(),
  });

  const keywordRows = await upsertKeywordRevenueMonthlyAdmin(
    buildKeywordRollups(business.id, transactions)
  );
  const gridRows = await upsertGridCellRevenueMonthlyAdmin(
    buildGridCellRollups(business.id, transactions)
  );
  const { observedAcv, sampleSize } = await refreshObservedAcvForBusiness(business.id);

  return { keywordRows, gridRows, rematched, observedAcv, sampleSize };
}
