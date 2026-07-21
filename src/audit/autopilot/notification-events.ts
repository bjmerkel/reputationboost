import { formatCellDirection } from "./leader-delta-engine";
import type { RankingExperiment } from "./types";
import { insertUserNotificationAdmin } from "@/audit/storage-notifications";

export async function notifyExperimentSuggested(
  experiment: RankingExperiment
): Promise<void> {
  await insertUserNotificationAdmin({
    userId: experiment.userId,
    businessId: experiment.businessId,
    type: "suggestion_created",
    experimentId: experiment.id,
    title: `Suggested test: ${experiment.keyword}`,
    body: `${formatCellDirection(experiment.gridNorth, experiment.gridEast)} — ${experiment.hypothesis}`,
  });
}

export async function notifyExperimentQueued(
  experiment: RankingExperiment
): Promise<void> {
  await insertUserNotificationAdmin({
    userId: experiment.userId,
    businessId: experiment.businessId,
    type: "experiment_queued",
    experimentId: experiment.id,
    title: `Experiment queued: ${experiment.keyword}`,
    body: `${formatCellDirection(experiment.gridNorth, experiment.gridEast)} is ready for your approval.`,
  });
}

export async function notifyExperimentConcluded(
  experiment: RankingExperiment
): Promise<void> {
  const outcome =
    experiment.status === "won"
      ? "moved up in the target cell"
      : experiment.status === "lost"
        ? "did not improve rank in the target cell"
        : "had inconclusive rank movement";

  await insertUserNotificationAdmin({
    userId: experiment.userId,
    businessId: experiment.businessId,
    type: "experiment_concluded",
    experimentId: experiment.id,
    title: `Experiment ${experiment.status}: ${experiment.keyword}`,
    body: `${formatCellDirection(experiment.gridNorth, experiment.gridEast)} ${outcome}. Your plan order has been updated.`,
  });
}
