import type { ActionAttribution } from "@/audit/types/timeseries";
import type {
  ExecutionTask,
  FullAuditPayload,
  GbpPlanStep,
  Plan,
  PlanPhase,
  PlanStep,
  PlanStepStatus,
  PlanProgress,
} from "../types";
import { getPhaseForStep, PLAN_PHASE_DEFINITIONS } from "./plan-phases";
import { isCustomPlanStep } from "./plan-custom-steps";
import { resolvePlanStepNumber } from "./plan-task-utils";
import { buildAttributionCalibration, mergeCalibrations } from "../phase2/attribution-calibration";
import type { AttributionCalibration } from "../phase2/attribution-calibration";
import { projectHealthScoresFromStepNumbers } from "../phase2/counterfactual";
import { buildStepContext } from "./step-context";
import { findStepOutcome } from "./step-outcomes";

function groupTasksByStep(tasks: ExecutionTask[]): Map<number, ExecutionTask[]> {
  const grouped = new Map<number, ExecutionTask[]>();
  for (const task of tasks) {
    const stepNumber = resolvePlanStepNumber(task);
    if (stepNumber == null) continue;
    const existing = grouped.get(stepNumber) ?? [];
    existing.push(task);
    grouped.set(stepNumber, existing);
  }
  return grouped;
}

function deriveStepStatus(tasks: ExecutionTask[]): PlanStepStatus {
  if (tasks.length === 0) return "pending";
  if (tasks.every((t) => t.status === "completed")) return "completed";
  if (tasks.some((t) => t.status === "rejected")) return "skipped";
  if (tasks.some((t) => t.status === "pending_approval")) return "needs_approval";
  if (tasks.every((t) => t.status === "approved" || t.status === "scheduled")) {
    return "approved";
  }
  if (tasks.some((t) => t.status === "failed")) return "needs_approval";
  return "pending";
}

function buildPlanStep(
  audit: FullAuditPayload,
  step: GbpPlanStep,
  tasks: ExecutionTask[],
  attributions: ActionAttribution[],
  calibration?: AttributionCalibration,
  avgCustomerValue?: number | null
): PlanStep {
  const status = deriveStepStatus(tasks);
  const outcome =
    status === "completed" ? findStepOutcome(step.stepNumber, tasks, attributions) : undefined;

  return {
    stepNumber: step.stepNumber,
    phaseId: getPhaseForStep(step.stepNumber),
    title: step.title,
    instruction: step.instruction,
    context: buildStepContext(audit, step, calibration, avgCustomerValue),
    gbpAction: step.gbpAction,
    actionData: step.actionData,
    copyBlocks: step.copyBlocks,
    bullets: step.bullets,
    tasks,
    status,
    outcome,
  };
}

function computeProgress(
  audit: FullAuditPayload,
  steps: PlanStep[],
  currentHealthScore: number,
  calibration?: AttributionCalibration
): PlanProgress {
  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const needsApproval = steps.filter((s) => s.status === "needs_approval").length;
  const remainingStepNumbers = steps
    .filter((s) => s.status !== "completed" && s.status !== "skipped")
    .map((s) => s.stepNumber)
    .filter((n) => !isCustomPlanStep(n));
  const projectedHealthScore =
    remainingStepNumbers.length > 0
      ? projectHealthScoresFromStepNumbers(audit, remainingStepNumbers, {
          calibration,
        }).projectedOverallScore
      : currentHealthScore;

  return {
    totalSteps,
    completedSteps,
    needsApproval,
    currentHealthScore,
    projectedHealthScore,
  };
}

function filterPhasesWithSteps(phases: PlanPhase[], steps: PlanStep[]): PlanPhase[] {
  const stepNumbers = new Set(steps.map((s) => s.stepNumber));
  const customStepNumbers = steps
    .filter((s) => isCustomPlanStep(s.stepNumber))
    .map((s) => s.stepNumber);

  return phases
    .map((phase) => ({
      ...phase,
      stepNumbers: [
        ...phase.stepNumbers.filter((n) => stepNumbers.has(n)),
        ...(phase.id === "ongoing" ? customStepNumbers : []),
      ],
    }))
    .filter((phase) => phase.stepNumbers.length > 0);
}

export function buildPlan(
  audit: FullAuditPayload,
  tasks: ExecutionTask[],
  attributions: ActionAttribution[] = [],
  globalCalibration?: AttributionCalibration,
  avgCustomerValue?: number | null
): Plan | null {
  const gbpPlan = audit.strategy?.gbpPlan;
  if (!gbpPlan) return null;

  const tasksByStep = groupTasksByStep(tasks);
  const calibration = mergeCalibrations(
    buildAttributionCalibration(attributions),
    globalCalibration
  );
  const planSteps = gbpPlan.steps.map((step) =>
    buildPlanStep(
      audit,
      step,
      tasksByStep.get(step.stepNumber) ?? [],
      attributions,
      calibration,
      avgCustomerValue
    )
  );

  const currentHealthScore = Number.isFinite(audit.strategy.scores?.overall)
    ? audit.strategy.scores.overall
    : 0;

  return {
    title: gbpPlan.title,
    businessName: gbpPlan.businessName,
    objective: gbpPlan.objective,
    targetKeywords: gbpPlan.targetKeywords,
    phases: filterPhasesWithSteps(PLAN_PHASE_DEFINITIONS, planSteps),
    steps: planSteps,
    progress: computeProgress(audit, planSteps, currentHealthScore, calibration),
  };
}
