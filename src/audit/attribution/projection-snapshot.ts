import type { ExecutionTask, FullAuditPayload } from "../types";
import type { AttributionCalibration } from "../phase2/attribution-calibration";
import { mergeCalibrations } from "../phase2/attribution-calibration";
import {
  estimateStepHealthImpact,
  estimateStepOutcomeImpact,
  estimateStepRevenueImpact,
} from "../phase2/score-impact";
import { isCustomPlanStep } from "../phase3/plan-custom-steps";
import { resolvePlanStepNumber } from "../phase3/plan-task-utils";

export interface TaskProjectionSnapshot {
  projectedDriverImpact: number | null;
  projectedOutcomeImpact: number | null;
  projectedRevenueGain: number | null;
  snapshotAt: string;
}

function readPayloadNumber(payload: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value);
    }
  }
  return null;
}

/** Fresh counterfactual projections for a plan step at completion time. */
export function snapshotTaskProjections(
  audit: FullAuditPayload,
  task: ExecutionTask,
  options?: {
    avgCustomerValue?: number | null;
    calibration?: AttributionCalibration;
    globalCalibration?: AttributionCalibration;
  }
): TaskProjectionSnapshot | null {
  const stepNumber = resolvePlanStepNumber(task);
  if (stepNumber == null || isCustomPlanStep(stepNumber)) return null;

  const calibration = mergeCalibrations(options?.calibration, options?.globalCalibration);

  return {
    projectedDriverImpact: estimateStepHealthImpact(audit, stepNumber, calibration),
    projectedOutcomeImpact: Math.max(0, estimateStepOutcomeImpact(audit, stepNumber)),
    projectedRevenueGain: estimateStepRevenueImpact(
      audit,
      stepNumber,
      options?.avgCustomerValue
    ),
    snapshotAt: new Date().toISOString(),
  };
}

/** Merge a completion-time snapshot into task payload, falling back to existing values. */
export function enrichTaskWithProjectionSnapshot(
  task: ExecutionTask,
  snapshot: TaskProjectionSnapshot | null
): ExecutionTask {
  if (!snapshot) return task;

  const payload = { ...task.payload };

  if (snapshot.projectedDriverImpact != null) {
    payload.projectedDriverImpact = snapshot.projectedDriverImpact;
  }
  if (snapshot.projectedOutcomeImpact != null) {
    payload.projectedOutcomeImpact = snapshot.projectedOutcomeImpact;
    payload.outcomeScoreImpact = snapshot.projectedOutcomeImpact;
  }
  if (snapshot.projectedRevenueGain != null && snapshot.projectedRevenueGain > 0) {
    payload.projectedRevenueGain = snapshot.projectedRevenueGain;
    payload.revenueImpact = snapshot.projectedRevenueGain;
  }
  payload.projectionsSnapshotAt = snapshot.snapshotAt;

  return { ...task, payload };
}

/** Resolve projected fields from payload when no audit snapshot is available. */
export function resolveProjectionsFromTask(task: ExecutionTask): TaskProjectionSnapshot {
  const payload = task.payload ?? {};
  return {
    projectedDriverImpact: readPayloadNumber(
      payload,
      "projectedDriverImpact",
      "healthScoreImpact"
    ),
    projectedOutcomeImpact: readPayloadNumber(
      payload,
      "projectedOutcomeImpact",
      "outcomeScoreImpact"
    ),
    projectedRevenueGain: readPayloadNumber(payload, "projectedRevenueGain", "revenueImpact"),
    snapshotAt:
      typeof payload.projectionsSnapshotAt === "string"
        ? payload.projectionsSnapshotAt
        : new Date().toISOString(),
  };
}
