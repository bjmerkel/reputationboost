import type { FullAuditPayload } from "@/audit/types";
import type { WebhookPayload } from "@/lib/integrations/webhook-types";
import { inferWebhookServiceNotes } from "@/lib/integrations/webhook-service";
import type { ClientConfig } from "@/audit/types";
import { matchTransactionToKeyword } from "./match-keyword";
import { matchTransactionToCell } from "./match-cell";
import { upsertRevenueTransactionAdmin } from "./storage-admin";
import type { RevenueTransactionRecord } from "./types";

const REVENUE_EVENT_TYPES = new Set(["job.completed", "invoice.paid", "appointment.completed"]);

function resolveOccurredAt(payload: WebhookPayload): string {
  if (payload.paidAt) return payload.paidAt;
  if (payload.bookedAt) return payload.bookedAt;
  if (payload.serviceDate) {
    const parsed = new Date(payload.serviceDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function isRevenueEvent(eventType: string): boolean {
  return REVENUE_EVENT_TYPES.has(eventType.trim().toLowerCase());
}

export interface IngestRevenueTransactionInput {
  businessId: string;
  userId: string;
  customerId: string;
  customerEventId: string;
  payload: WebhookPayload;
  audit: FullAuditPayload | null;
  business: ClientConfig;
}

/** Persist a CRM transaction when amount is present on a revenue event. */
export async function ingestRevenueTransactionFromWebhook(
  input: IngestRevenueTransactionInput
): Promise<RevenueTransactionRecord | null> {
  if (!isRevenueEvent(input.payload.event)) return null;
  if (input.payload.amount == null || input.payload.amount <= 0) return null;

  const serviceText =
    inferWebhookServiceNotes(input.payload, input.audit) ??
    input.payload.service ??
    input.payload.jobType ??
    input.payload.lineItemTitle;

  const keywordMatch = matchTransactionToKeyword(serviceText, input.audit);
  const cellMatch = matchTransactionToCell(
    { jobLat: input.payload.jobLat, jobLng: input.payload.jobLng },
    input.business
  );

  let matchMethod = keywordMatch.method;
  let matchConfidence = keywordMatch.confidence;
  if (
    input.payload.leadSource &&
    /google|gbp|maps|local/i.test(input.payload.leadSource)
  ) {
    matchMethod = "lead_source";
    matchConfidence = Math.max(matchConfidence ?? 0, 0.85);
  }

  return upsertRevenueTransactionAdmin({
    businessId: input.businessId,
    userId: input.userId,
    customerId: input.customerId,
    customerEventId: input.customerEventId,
    externalId: input.payload.externalId,
    source: input.payload.source ?? "webhook",
    eventType: input.payload.event,
    amount: input.payload.amount,
    currency: input.payload.currency ?? "USD",
    occurredAt: resolveOccurredAt(input.payload),
    matchedKeyword: keywordMatch.keyword,
    matchedGridNorth: cellMatch.gridNorth,
    matchedGridEast: cellMatch.gridEast,
    matchedZone: cellMatch.zone,
    matchMethod,
    matchConfidence,
  });
}
