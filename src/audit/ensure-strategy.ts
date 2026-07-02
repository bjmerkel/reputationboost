import type { FullAuditPayload } from "@/audit/types";
import { generateStrategy } from "@/audit/phase2";

/** Backfill strategy for audits saved before Phase 2. */
export function ensureStrategy(audit: FullAuditPayload): FullAuditPayload {
  if (audit.strategy) return audit;
  return { ...audit, strategy: generateStrategy(audit, null) };
}
