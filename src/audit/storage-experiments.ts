import type {
  ConcludedRankingExperiment,
  RankingExperiment,
  RankingExperimentStatus,
} from "@/audit/autopilot/types";
import type { BanditMetadata, LeaderDelta } from "@/audit/autopilot/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function rowToExperiment(row: Record<string, unknown>): RankingExperiment {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    userId: row.user_id as string,
    auditId: row.audit_id as string,
    keyword: row.keyword as string,
    gridNorth: Number(row.grid_north),
    gridEast: Number(row.grid_east),
    leaderPlaceId: row.leader_place_id as string,
    leaderName: row.leader_name as string,
    actionType: row.action_type as RankingExperiment["actionType"],
    planStepNumber:
      row.plan_step_number != null ? Number(row.plan_step_number) : null,
    hypothesis: row.hypothesis as string,
    leaderDelta: row.leader_delta as LeaderDelta,
    marketKey: row.market_key as string,
    origin: (row.origin as RankingExperiment["origin"]) ?? "manual",
    banditMetadata: (row.bandit_metadata as BanditMetadata | null) ?? null,
    status: row.status as RankingExperimentStatus,
    executionTaskId: (row.execution_task_id as string) ?? null,
    baselineSnapshotDate: row.baseline_snapshot_date as string,
    targetRankBefore:
      row.target_rank_before != null ? Number(row.target_rank_before) : null,
    targetRankAfter:
      row.target_rank_after != null ? Number(row.target_rank_after) : null,
    targetCellImproved:
      row.target_cell_improved != null
        ? Boolean(row.target_cell_improved)
        : null,
    attributionWindowDays: Number(row.attribution_window_days ?? 14),
    startedAt: (row.started_at as string) ?? null,
    concludedAt: (row.concluded_at as string) ?? null,
    conclusionReason: (row.conclusion_reason as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function experimentToRow(
  experiment: RankingExperiment
): Record<string, unknown> {
  return {
    id: experiment.id,
    business_id: experiment.businessId,
    user_id: experiment.userId,
    audit_id: experiment.auditId,
    keyword: experiment.keyword,
    grid_north: experiment.gridNorth,
    grid_east: experiment.gridEast,
    leader_place_id: experiment.leaderPlaceId,
    leader_name: experiment.leaderName,
    action_type: experiment.actionType,
    plan_step_number: experiment.planStepNumber,
    hypothesis: experiment.hypothesis,
    leader_delta: experiment.leaderDelta,
    market_key: experiment.marketKey,
    origin: experiment.origin,
    bandit_metadata: experiment.banditMetadata,
    status: experiment.status,
    execution_task_id: experiment.executionTaskId,
    baseline_snapshot_date: experiment.baselineSnapshotDate,
    target_rank_before: experiment.targetRankBefore,
    target_rank_after: experiment.targetRankAfter,
    target_cell_improved: experiment.targetCellImproved,
    attribution_window_days: experiment.attributionWindowDays,
    started_at: experiment.startedAt,
    concluded_at: experiment.concludedAt,
    conclusion_reason: experiment.conclusionReason,
    updated_at: new Date().toISOString(),
  };
}

const ACTIVE_STATUSES: RankingExperimentStatus[] = [
  "proposed",
  "pending_approval",
  "running",
  "measuring",
];

export async function insertRankingExperiment(
  experiment: RankingExperiment
): Promise<RankingExperiment> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ranking_experiments")
    .insert({
      ...experimentToRow(experiment),
      created_at: experiment.createdAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert ranking_experiment: ${error?.message}`);
  }
  return rowToExperiment(data);
}

export async function updateRankingExperimentAdmin(
  experimentId: string,
  patch: Partial<
    Pick<
      RankingExperiment,
      | "status"
      | "executionTaskId"
      | "targetRankBefore"
      | "targetRankAfter"
      | "targetCellImproved"
      | "startedAt"
      | "concludedAt"
      | "conclusionReason"
    >
  >
): Promise<RankingExperiment | null> {
  const supabase = createAdminClient();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) row.status = patch.status;
  if (patch.executionTaskId !== undefined) {
    row.execution_task_id = patch.executionTaskId;
  }
  if (patch.targetRankBefore !== undefined) {
    row.target_rank_before = patch.targetRankBefore;
  }
  if (patch.targetRankAfter !== undefined) {
    row.target_rank_after = patch.targetRankAfter;
  }
  if (patch.targetCellImproved !== undefined) {
    row.target_cell_improved = patch.targetCellImproved;
  }
  if (patch.startedAt !== undefined) row.started_at = patch.startedAt;
  if (patch.concludedAt !== undefined) row.concluded_at = patch.concludedAt;
  if (patch.conclusionReason !== undefined) {
    row.conclusion_reason = patch.conclusionReason;
  }

  const { data, error } = await supabase
    .from("ranking_experiments")
    .update(row)
    .eq("id", experimentId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return rowToExperiment(data);
}

export async function getRankingExperimentByIdAdmin(
  experimentId: string
): Promise<RankingExperiment | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ranking_experiments")
    .select("*")
    .eq("id", experimentId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToExperiment(data);
}

export async function getRankingExperimentByTaskIdAdmin(
  taskId: string
): Promise<RankingExperiment | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ranking_experiments")
    .select("*")
    .eq("execution_task_id", taskId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToExperiment(data);
}

export async function listRankingExperimentsForBusinessAdmin(
  businessId: string,
  limit = 20
): Promise<RankingExperiment[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ranking_experiments")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => rowToExperiment(row));
}

export async function listConcludedExperimentsForBusinessAdmin(
  businessId: string,
  limit = 100
): Promise<ConcludedRankingExperiment[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ranking_experiments")
    .select("*")
    .eq("business_id", businessId)
    .in("status", ["won", "lost", "inconclusive"])
    .order("concluded_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => rowToExperiment(row) as ConcludedRankingExperiment);
}

export async function listProposedSuggestionsForBusinessAdmin(
  businessId: string
): Promise<RankingExperiment[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ranking_experiments")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "proposed")
    .eq("origin", "suggested")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => rowToExperiment(row));
}

export async function dismissSuggestedExperimentAdmin(
  experimentId: string
): Promise<RankingExperiment | null> {
  return updateRankingExperimentAdmin(experimentId, {
    status: "cancelled",
    concludedAt: new Date().toISOString(),
    conclusionReason: "Suggestion dismissed by user.",
  });
}

export async function listRankingExperimentsForUser(
  userId: string,
  businessId: string,
  limit = 20
): Promise<RankingExperiment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ranking_experiments")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => rowToExperiment(row));
}

export async function getActiveExperimentForCellAdmin(
  businessId: string,
  keyword: string,
  gridNorth: number,
  gridEast: number
): Promise<RankingExperiment | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ranking_experiments")
    .select("*")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .eq("grid_north", gridNorth)
    .eq("grid_east", gridEast)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();

  if (error || !data) return null;
  return rowToExperiment(data);
}

export async function listMeasuringExperimentsAdmin(
  limit = 50
): Promise<RankingExperiment[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ranking_experiments")
    .select("*")
    .eq("status", "measuring")
    .order("started_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => rowToExperiment(row));
}

export function isActiveExperimentStatus(status: RankingExperimentStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}
