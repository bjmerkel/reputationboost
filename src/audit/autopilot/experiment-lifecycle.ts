import type { ExecutionTask } from "@/audit/types";
import type { RankingExperiment, RankingExperimentStatus } from "@/audit/autopilot/types";
import { enqueueEventRankPulse } from "@/audit/market/refresh-queue";
import { MARKET_REFRESH_FLAGS } from "@/lib/feature-flags";
import { taskCanAffectLocalRank } from "@/audit/market/gbp-change-detector";
import {
  getRankingExperimentByIdAdmin,
  getRankingExperimentByTaskIdAdmin,
  updateRankingExperimentAdmin,
} from "@/audit/storage-experiments";
import { loadGridForDateAdmin } from "@/audit/storage-grid-snapshots";

function rankAtCell(
  grid: Awaited<ReturnType<typeof loadGridForDateAdmin>>,
  north: number,
  east: number
): number | null {
  const point = grid.find(
    (cell) => cell.offsetNorthMiles === north && cell.offsetEastMiles === east
  );
  return point?.rank ?? null;
}

export function evaluateExperimentOutcome(params: {
  rankBefore: number | null;
  rankAfter: number | null;
}): { status: RankingExperimentStatus; reason: string; improved: boolean } {
  const { rankBefore, rankAfter } = params;

  if (rankAfter == null && rankBefore == null) {
    return {
      status: "inconclusive",
      reason: "No rank signal before or after in the target cell.",
      improved: false,
    };
  }

  if (rankAfter != null && rankAfter <= 3 && (rankBefore == null || rankBefore > 3)) {
    return {
      status: "won",
      reason: "Entered the local 3-pack in the target cell.",
      improved: true,
    };
  }

  if (rankBefore != null && rankAfter != null && rankAfter < rankBefore) {
    return {
      status: "won",
      reason: `Improved from #${rankBefore} to #${rankAfter} in the target cell.`,
      improved: true,
    };
  }

  if (rankBefore != null && rankAfter != null && rankAfter === rankBefore) {
    return {
      status: "inconclusive",
      reason: `No rank movement in the target cell (stayed #${rankAfter}).`,
      improved: false,
    };
  }

  return {
    status: "lost",
    reason:
      rankAfter == null
        ? "Still not visible in the target cell after the measurement window."
        : `Rank did not improve (#${rankBefore ?? "—"} → #${rankAfter}).`,
    improved: false,
  };
}

export async function onExperimentTaskApproved(task: ExecutionTask): Promise<void> {
  const experimentId = task.payload.experimentId;
  if (typeof experimentId !== "string") return;

  await updateRankingExperimentAdmin(experimentId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });
}

export async function onExperimentTaskCompleted(
  task: ExecutionTask,
  businessId: string
): Promise<void> {
  const experiment = await getRankingExperimentByTaskIdAdmin(task.id);
  if (!experiment) return;

  await updateRankingExperimentAdmin(experiment.id, {
    status: "measuring",
    startedAt: experiment.startedAt ?? task.completedAt ?? new Date().toISOString(),
    targetRankBefore:
      experiment.targetRankBefore ?? experiment.leaderDelta.clientRank,
  });

  if (taskCanAffectLocalRank(task.type)) {
    const completedAt = new Date(task.completedAt ?? Date.now());
    completedAt.setUTCDate(
      completedAt.getUTCDate() + MARKET_REFRESH_FLAGS.eventDelayDays
    );
    await enqueueEventRankPulse({
      businessId,
      triggerSource: "task_completion",
      triggerRef: task.id,
      runAfter: completedAt.toISOString(),
      keywordScope: experiment.keyword,
      callsEstimated: 1,
    }).catch(() => undefined);
  }
}

export async function concludeExperimentIfReady(
  experiment: RankingExperiment
): Promise<RankingExperiment | null> {
  if (experiment.status !== "measuring" || !experiment.startedAt) return null;

  const windowEnd = new Date(experiment.startedAt);
  windowEnd.setUTCDate(
    windowEnd.getUTCDate() + experiment.attributionWindowDays
  );
  if (Date.now() < windowEnd.getTime()) return null;

  const afterGrid = await loadGridForDateAdmin(
    experiment.businessId,
    experiment.keyword,
    new Date().toISOString().slice(0, 10)
  );
  const rankAfter = rankAtCell(
    afterGrid,
    experiment.gridNorth,
    experiment.gridEast
  );

  const beforeGrid = await loadGridForDateAdmin(
    experiment.businessId,
    experiment.keyword,
    experiment.baselineSnapshotDate
  );
  const rankBefore =
    experiment.targetRankBefore ??
    rankAtCell(beforeGrid, experiment.gridNorth, experiment.gridEast);

  const outcome = evaluateExperimentOutcome({
    rankBefore,
    rankAfter,
  });

  return updateRankingExperimentAdmin(experiment.id, {
    status: outcome.status,
    targetRankBefore: rankBefore,
    targetRankAfter: rankAfter,
    targetCellImproved: outcome.improved,
    concludedAt: new Date().toISOString(),
    conclusionReason: outcome.reason,
  });
}

export async function concludeMeasuringExperimentsForBusiness(
  businessId: string
): Promise<number> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ranking_experiments")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "measuring");

  let concluded = 0;
  for (const row of data ?? []) {
    const experiment = await getRankingExperimentByIdAdmin(row.id as string);
    if (!experiment) continue;
    if (await concludeExperimentIfReady(experiment)) concluded += 1;
  }
  return concluded;
}

export function experimentPayloadKeyword(task: ExecutionTask): string | null {
  const keyword = task.payload.targetKeyword;
  return typeof keyword === "string" ? keyword : null;
}
