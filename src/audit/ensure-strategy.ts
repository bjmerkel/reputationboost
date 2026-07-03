import type { FullAuditPayload, Phase1AuditPayload } from "@/audit/types";
import { buildStrategy } from "@/audit/phase2/strategy";
import { buildFirstAuditReport, buildMonthlyReport } from "@/audit/phase2/monthly-report";
import { buildTemplateGbpPlan } from "@/audit/phase2/gbp-plan";
import { buildTemplateContent } from "@/lib/llm/content";
import { normalizeTextContent } from "@/lib/llm/normalize-content";
import { generateExecutionQueue } from "@/audit/phase3";

function normalizeStrategyDrafts(
  audit: FullAuditPayload
): FullAuditPayload["strategy"] {
  const strategy = audit.strategy;
  if (!strategy) return strategy;

  return {
    ...strategy,
    actionPlan: strategy.actionPlan.map((action) =>
      action.draftCopy
        ? { ...action, draftCopy: normalizeTextContent(action.draftCopy) }
        : action
    ),
  };
}

function normalizeExecutionReport(
  execution: NonNullable<FullAuditPayload["execution"]>
): NonNullable<FullAuditPayload["execution"]> {
  return {
    ...execution,
    tasks: execution.tasks.map((task) => ({
      ...task,
      draftContent: normalizeTextContent(task.draftContent),
    })),
  };
}

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

  const withMonthly = {
    ...withStrategy,
    strategy: {
      ...normalizeStrategyDrafts({ ...withStrategy, strategy })!,
      gbpPlan: strategy.gbpPlan ?? buildTemplateGbpPlan(audit),
    },
  };

  if (withMonthly.execution) {
    return {
      ...withMonthly,
      execution: normalizeExecutionReport(withMonthly.execution),
    };
  }

  const content = buildTemplateContent(withMonthly);
  return { ...withMonthly, execution: generateExecutionQueue(withMonthly, content) };
}
