import type { FullAuditPayload } from "@/audit/types";
import { generateStrategy } from "@/audit/phase2";
import { generateExecutionQueue } from "@/audit/phase3";

/** Backfill strategy and execution queue for audits saved before Phase 2/3. */
export function ensureStrategy(audit: FullAuditPayload): FullAuditPayload {
  const withStrategy = audit.strategy
    ? audit
    : { ...audit, strategy: generateStrategy(audit, null) };

  if (withStrategy.execution) return withStrategy;
  return { ...withStrategy, execution: generateExecutionQueue(withStrategy) };
}
