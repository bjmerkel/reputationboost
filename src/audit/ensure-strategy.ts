import type { FullAuditPayload } from "@/audit/types";
import { buildStrategy } from "@/audit/phase2/strategy";
import { buildTemplateContent } from "@/lib/llm/content";
import { generateExecutionQueue } from "@/audit/phase3";

/** Backfill strategy and execution queue for audits saved before Phase 2/3. */
export function ensureStrategy(audit: FullAuditPayload): FullAuditPayload {
  const withStrategy = audit.strategy
    ? audit
    : { ...audit, strategy: buildStrategy(audit, null) };

  if (withStrategy.execution) return withStrategy;

  const content = buildTemplateContent(withStrategy);
  return { ...withStrategy, execution: generateExecutionQueue(withStrategy, content) };
}
