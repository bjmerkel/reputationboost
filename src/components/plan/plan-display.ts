import type { PlanStep } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { formatAttributionTrackingLabel } from "@/lib/attribution/tracking-label";

/** Steps hidden from the Plan tab (fully rejected with no remaining work). */
export function filterVisiblePlanSteps(steps: PlanStep[]): PlanStep[] {
  return [...steps]
    .filter((step) => step.status !== "skipped")
    .sort((a, b) => {
      const aDone = a.status === "completed" ? 1 : 0;
      const bDone = b.status === "completed" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (a.displayOrder ?? a.stepNumber) - (b.displayOrder ?? b.stepNumber);
    });
}

export function partitionVisiblePlanSteps(steps: PlanStep[]): {
  visible: PlanStep[];
  open: PlanStep[];
  completed: PlanStep[];
  phaseNeedsApproval: boolean;
} {
  const visible = filterVisiblePlanSteps(steps);
  const open = visible.filter((step) => step.status !== "completed");
  const completed = visible.filter((step) => step.status === "completed");
  return {
    visible,
    open,
    completed,
    phaseNeedsApproval: open.some((step) => step.status === "needs_approval"),
  };
}

export function planProgressPercent(completedSteps: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  return Math.round((completedSteps / totalSteps) * 100);
}

export interface PlanProjectionDisplayInput {
  estimatedMonthlyRevenue?: number | null;
  projectedMonthlyRevenue?: number | null;
  estimatedMonthlyLeads?: number | null;
  projectedMonthlyLeads?: number | null;
  estimatedMonthlyActions?: number | null;
  projectedMonthlyActions?: number | null;
  nextThreeEstimatedMonthlyRevenue?: number | null;
  nextThreeProjectedMonthlyRevenue?: number | null;
  nextThreeEstimatedMonthlyLeads?: number | null;
  nextThreeProjectedMonthlyLeads?: number | null;
  nextThreeEstimatedMonthlyActions?: number | null;
  nextThreeProjectedMonthlyActions?: number | null;
  pathStepCount?: number;
  nextThreeStepCount?: number;
}

export interface PlanProjectionDisplay {
  showRevenue: boolean;
  showActions: boolean;
  showLeads: boolean;
  showNextThreeRevenue: boolean;
  showNextThreeActions: boolean;
  showNextThreeLeads: boolean;
}

export function resolvePlanProjectionDisplay(
  input: PlanProjectionDisplayInput
): PlanProjectionDisplay {
  const showRevenue =
    input.estimatedMonthlyRevenue != null &&
    input.projectedMonthlyRevenue != null &&
    input.estimatedMonthlyRevenue > 0;
  const showActions =
    !showRevenue &&
    input.projectedMonthlyActions != null &&
    input.projectedMonthlyActions > 0;
  const showLeads =
    !showRevenue &&
    !showActions &&
    input.estimatedMonthlyLeads != null &&
    input.projectedMonthlyLeads != null &&
    input.estimatedMonthlyLeads > 0;
  const showNextThreeRevenue =
    input.nextThreeEstimatedMonthlyRevenue != null &&
    input.nextThreeProjectedMonthlyRevenue != null &&
    input.nextThreeEstimatedMonthlyRevenue > 0 &&
    (input.nextThreeProjectedMonthlyRevenue !== input.projectedMonthlyRevenue ||
      (input.nextThreeStepCount ?? 0) < (input.pathStepCount ?? 0));
  const showNextThreeActions =
    !showNextThreeRevenue &&
    input.nextThreeEstimatedMonthlyActions != null &&
    input.nextThreeProjectedMonthlyActions != null &&
    input.nextThreeEstimatedMonthlyActions > 0 &&
    (input.nextThreeProjectedMonthlyActions !== input.projectedMonthlyActions ||
      (input.nextThreeStepCount ?? 0) < (input.pathStepCount ?? 0));
  const showNextThreeLeads =
    !showNextThreeRevenue &&
    !showNextThreeActions &&
    input.nextThreeEstimatedMonthlyLeads != null &&
    input.nextThreeProjectedMonthlyLeads != null &&
    input.nextThreeEstimatedMonthlyLeads > 0;

  return {
    showRevenue,
    showActions,
    showLeads,
    showNextThreeRevenue,
    showNextThreeActions,
    showNextThreeLeads,
  };
}

export function planApprovalBadgeCopy(count: number, interactive: boolean): string {
  if (interactive) {
    return `${count} need approval → Review`;
  }
  return `${count} need${count === 1 ? "s" : ""} your approval`;
}

/** Completed steps with preliminary attribution show measuring / early-signal copy. */
export function formatStepAttributionTrackingLabel(
  step: PlanStep,
  attributionByTaskId: Record<string, ActionAttribution>
): string | null {
  if (step.status !== "completed") return null;
  const attribution = step.tasks
    .map((task) => attributionByTaskId[task.id])
    .find((item) => item?.preliminary);
  return attribution ? formatAttributionTrackingLabel(attribution) : null;
}
