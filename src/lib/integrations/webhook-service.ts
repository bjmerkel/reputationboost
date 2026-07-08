import type { FullAuditPayload } from "@/audit/types";
import type { WebhookPayload } from "./webhook-types";

function significantTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["near", "best", "local"].includes(w));
}

function readLineItemTitle(record: Record<string, unknown>): string | undefined {
  for (const key of ["lineItems", "line_items", "services", "jobLineItems", "job_line_items"]) {
    const value = record[key];
    if (!Array.isArray(value) || value.length === 0) continue;
    const first = value[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const item = first as Record<string, unknown>;
      const name = [item.name, item.title, item.description, item.serviceName, item.service_name]
        .find((v) => typeof v === "string" && v.trim());
      if (typeof name === "string") return name.trim();
    }
  }
  return undefined;
}

export function resolveWebhookServiceRaw(record: Record<string, unknown>): string | undefined {
  const directKeys = [
    "service",
    "serviceNotes",
    "service_notes",
    "job",
    "jobTitle",
    "job_title",
    "jobType",
    "job_type",
    "serviceType",
    "service_type",
    "workType",
    "work_type",
    "title",
  ];

  for (const key of directKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return readLineItemTitle(record);
}

function auditKeywords(audit: FullAuditPayload | null): string[] {
  if (!audit) return [];
  const fromPlan = audit.strategy.gbpPlan?.targetKeywords ?? [];
  if (fromPlan.length > 0) return fromPlan;
  return audit.rankings.keywords.map((k) => k.keyword);
}

function matchAuditKeyword(serviceText: string, keywords: string[]): string | null {
  const lower = serviceText.toLowerCase();
  for (const keyword of keywords) {
    const tokens = significantTokens(keyword);
    if (tokens.length === 0) {
      if (lower.includes(keyword.toLowerCase())) return keyword;
      continue;
    }
    if (tokens.some((token) => lower.includes(token))) return keyword;
  }
  return null;
}

/** Map CRM / Jobber job fields to a Service value aligned with audit keywords when possible. */
export function inferWebhookServiceNotes(
  payload: Pick<WebhookPayload, "service" | "jobType" | "lineItemTitle">,
  audit: FullAuditPayload | null
): string | undefined {
  const candidates = [payload.service, payload.jobType, payload.lineItemTitle]
    .map((value) => value?.trim())
    .filter(Boolean) as string[];

  if (candidates.length === 0) return undefined;

  const keywords = auditKeywords(audit);
  for (const candidate of candidates) {
    const matched = matchAuditKeyword(candidate, keywords);
    if (matched) return matched;
  }

  return candidates[0];
}
