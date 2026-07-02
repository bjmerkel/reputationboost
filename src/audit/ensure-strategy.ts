import type { FullAuditPayload, Phase1AuditPayload } from "@/audit/types";
import { buildStrategy } from "@/audit/phase2/strategy";
import { buildFirstAuditReport, buildMonthlyReport } from "@/audit/phase2/monthly-report";
import { buildTemplateContent } from "@/lib/llm/content";
import { generateExecutionQueue } from "@/audit/phase3";

/** Backfill strategy and execution queue for audits saved before Phase 2/3. */
export function ensureStrategy(
  audit: FullAuditPayload,
  priorAudit: Phase1AuditPayload | null = null
): FullAuditPayload {
  const withStrategy = audit.strategy
    ? audit
    : { ...audit, strategy: buildStrategy(audit, priorAudit) };

  let strategy = withStrategy.strategy;

  const needsMomBackfill =
    priorAudit &&
    (!strategy.monthOverMonth?.rankMovements ||
      strategy.monthlyReport === null ||
      strategy.monthlyReport === undefined);

  if (needsMomBackfill) {
    const rebuilt = buildStrategy(audit, priorAudit);
    strategy = {
      ...strategy,
      monthOverMonth: rebuilt.monthOverMonth,
      monthlyReport: rebuilt.monthlyReport,
    };
  } else if (!strategy.monthlyReport) {
    strategy = {
      ...strategy,
      monthlyReport: priorAudit
        ? buildMonthlyReport(audit, priorAudit, strategy)
        : buildFirstAuditReport(audit, strategy),
    };
  }

  const withMonthly = { ...withStrategy, strategy };

  if (withMonthly.execution) return withMonthly;

  const content = buildTemplateContent(withMonthly);
  return { ...withMonthly, execution: generateExecutionQueue(withMonthly, content) };
}
