import type { FullAuditPayload, Plan } from "../types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { resolvePlanStepNumber } from "./plan-task-utils";

export interface PlanTimelineEntry {
  id: string;
  date: string;
  kind: "action" | "baseline" | "rank_shift";
  title: string;
  narrative: string;
  keyword?: string;
  rankBefore?: number | null;
  rankAfter?: number | null;
  stepNumber?: number;
  preliminary?: boolean;
}

function formatRank(rank: number | null): string {
  if (rank === null) return "—";
  if (rank > 20) return "#20+";
  return `#${rank}`;
}

export function buildPlanTimeline(
  audit: FullAuditPayload,
  plan: Plan | null,
  attributions: ActionAttribution[]
): PlanTimelineEntry[] {
  const entries: PlanTimelineEntry[] = [];
  const seenAttribution = new Set<string>();

  for (const attr of [...attributions].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )) {
    if (seenAttribution.has(attr.id)) continue;
    seenAttribution.add(attr.id);

    const stepNumber = attr.actionItemId.startsWith("gbp-step-")
      ? Number.parseInt(attr.actionItemId.replace("gbp-step-", ""), 10)
      : undefined;

    const rankLine =
      attr.rankBefore !== attr.rankAfter && attr.rankAfter !== null && attr.primaryKeyword
        ? `'${attr.primaryKeyword}' ${formatRank(attr.rankBefore)} → ${formatRank(attr.rankAfter)}`
        : null;

    const engagement: string[] = [];
    if ((attr.callsDelta ?? 0) > 0) engagement.push(`+${attr.callsDelta} calls`);
    if ((attr.directionsDelta ?? 0) > 0) engagement.push(`+${attr.directionsDelta} directions`);
    if ((attr.websiteClicksDelta ?? 0) > 0) engagement.push(`+${attr.websiteClicksDelta} clicks`);

    const narrative = [rankLine, ...engagement, attr.narrative !== rankLine ? attr.narrative : null]
      .filter(Boolean)
      .join(" · ");

    entries.push({
      id: attr.id,
      date: attr.publishedAt,
      kind: "action",
      title: attr.title,
      narrative: narrative || attr.narrative,
      keyword: attr.primaryKeyword ?? undefined,
      rankBefore: attr.rankBefore,
      rankAfter: attr.rankAfter,
      stepNumber: Number.isFinite(stepNumber) ? stepNumber : undefined,
      preliminary: attr.preliminary,
    });
  }

  if (plan) {
    for (const step of plan.steps) {
      if (step.status !== "completed" || !step.outcome) continue;
      if (step.outcome.attributionId && seenAttribution.has(step.outcome.attributionId)) {
        continue;
      }
      entries.push({
        id: `step-${step.stepNumber}`,
        date: step.outcome.publishedAt,
        kind: "action",
        title: `Step ${step.stepNumber}: ${step.title}`,
        narrative: step.outcome.narrative ?? `Completed ${step.title}`,
        keyword: step.outcome.keyword,
        rankBefore: step.outcome.rankBefore,
        rankAfter: step.outcome.rankAfter,
        stepNumber: step.stepNumber,
      });
    }
  }

  const mom = audit.strategy?.monthOverMonth;
  if (mom?.rankMovements?.length) {
    for (const movement of mom.rankMovements.slice(0, 5)) {
      if (!movement.improved && movement.fromPosition === movement.toPosition) continue;
      entries.push({
        id: `rank-${movement.keyword}`,
        date: audit.completedAt,
        kind: "rank_shift",
        title: movement.keyword,
        narrative: movement.improved
          ? `Moved into stronger position: ${formatRank(movement.fromPosition)} → ${formatRank(movement.toPosition)}`
          : `Rank changed: ${formatRank(movement.fromPosition)} → ${formatRank(movement.toPosition)}`,
        keyword: movement.keyword,
        rankBefore: movement.fromPosition,
        rankAfter: movement.toPosition,
      });
    }
  }

  entries.push({
    id: `baseline-${audit.auditId}`,
    date: audit.completedAt,
    kind: "baseline",
    title: audit.strategy?.monthlyReport?.hasPriorPeriod ? "Latest audit" : "Audit baseline",
    narrative: audit.strategy?.monthlyReport?.headline
      ?? `Profile health ${audit.strategy?.scores?.overall ?? "—"}/100 · ${audit.rankings.keywordsInPack}/${audit.rankings.totalKeywords} keywords in local pack`,
  });

  return entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/** Resolve step number from a completed task when building supplemental timeline rows. */
export function stepNumberFromTask(task: { actionItemId: string; payload: Record<string, unknown> }): number | undefined {
  const resolved = resolvePlanStepNumber(task as import("../types").ExecutionTask);
  return resolved ?? undefined;
}
