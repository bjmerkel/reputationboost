import { createId } from "@/lib/create-id";
import type {
  ExecutionTask,
  FullAuditPayload,
  Phase1AuditPayload,
} from "@/audit/types";
import type {
  BanditMetadata,
  LeaderDelta,
  LeaderDeltaAction,
  RankingExperiment,
} from "@/audit/autopilot/types";
import type { BanditSelection } from "@/audit/autopilot/bandit";
import { selectActionWithBandit } from "@/audit/autopilot/bandit";
import { deriveMarketKey } from "@/audit/autopilot/market-key";
import type { ExperimentOrigin } from "@/audit/autopilot/modes";
import { formatCellDirection } from "@/audit/autopilot/leader-delta-engine";
import type { MarketCalibrationIndex } from "@/audit/autopilot/market-calibration";
import {
  getActiveExperimentForCellAdmin,
  getRankingExperimentByIdAdmin,
  insertRankingExperiment,
  updateRankingExperimentAdmin,
} from "@/audit/storage-experiments";
import { appendExecutionTasks } from "@/audit/storage-execution";
import { RANK_ATTRIBUTION_WINDOW_DAYS } from "@/audit/attribution/window";

function requiresApproval(type: ExecutionTask["type"]): boolean {
  return !["checklist", "manual"].includes(type);
}

function banditMetadataFromSelection(selection: BanditSelection): BanditMetadata {
  return {
    selectedIndex: selection.actionIndex,
    ucbScore: selection.ucbScore,
    explorationReason: selection.explorationReason,
    alternatives: selection.alternatives,
  };
}

function draftContentForAction(
  audit: Phase1AuditPayload,
  delta: LeaderDelta,
  action: LeaderDeltaAction
): string {
  const keyword = delta.keyword;
  switch (action.actionType) {
    case "gbp_services":
      return [
        "Add the following GBP services:",
        ...delta.dimensions.servicesListed.missing.slice(0, 3).map((s) => `- ${s}`),
      ].join("\n");
    case "gbp_primary_category":
      return `Set primary category to: ${delta.dimensions.primaryCategory.leader}`;
    case "gbp_secondary_categories":
      return [
        "Add secondary categories:",
        ...delta.dimensions.secondaryCategories.missing
          .slice(0, 3)
          .map((c) => `- ${c}`),
      ].join("\n");
    case "gbp_description":
      return audit.gbp.liveProfile?.description?.trim()
        ? audit.gbp.liveProfile.description
        : `Expand your business description to better target “${keyword}”.`;
    case "google_post":
      return `Share a Google post highlighting “${keyword}” and a clear call to action.`;
    case "gbp_photo":
      return "Upload recent on-site or team photos that match this service area.";
    case "gbp_attributes":
      return "Enable additional GBP attributes that competitors in this cell are using.";
    case "review_request":
      return `Request reviews from recent customers for “${keyword}” visibility.`;
    default:
      return action.hypothesis;
  }
}

export function buildExecutionTaskForExperiment(params: {
  audit: FullAuditPayload;
  experiment: RankingExperiment;
  action: LeaderDeltaAction;
}): ExecutionTask {
  const { audit, experiment, action } = params;
  const needsApproval = requiresApproval(action.actionType);
  const location = formatCellDirection(experiment.gridNorth, experiment.gridEast);

  return {
    id: createId(),
    auditId: audit.auditId,
    actionItemId: `autopilot-exp-${experiment.id}`,
    type: action.actionType,
    title: `Experiment: ${action.hypothesis.slice(0, 72)}${action.hypothesis.length > 72 ? "…" : ""}`,
    description: [
      `Beat-the-leader test for “${experiment.keyword}” from ${location}.`,
      action.hypothesis,
      `Cell leader: ${experiment.leaderName}.`,
      experiment.banditMetadata?.explorationReason
        ? `Selection: ${experiment.banditMetadata.explorationReason}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    priority: "P1",
    status: needsApproval ? "pending_approval" : "approved",
    draftContent: draftContentForAction(audit, experiment.leaderDelta, action),
    payload: {
      experimentId: experiment.id,
      targetKeyword: experiment.keyword,
      targetCell: {
        gridNorth: experiment.gridNorth,
        gridEast: experiment.gridEast,
      },
      leaderPlaceId: experiment.leaderPlaceId,
      leaderName: experiment.leaderName,
      hypothesis: action.hypothesis,
      targetKeywords: [experiment.keyword],
      baselineSnapshotDate: experiment.baselineSnapshotDate,
      targetRankBefore: experiment.targetRankBefore,
      autopilot: true,
    },
    requiresApproval: needsApproval,
    scheduledFor: needsApproval ? null : new Date().toISOString(),
    completedAt: null,
    result: null,
    createdAt: new Date().toISOString(),
    planStepNumber: action.planStepNumber,
    planPhaseId: "foundation",
  };
}

function buildExperimentRecord(params: {
  audit: FullAuditPayload;
  delta: LeaderDelta;
  userId: string;
  businessId: string;
  action: LeaderDeltaAction;
  origin: ExperimentOrigin;
  banditMetadata: BanditMetadata | null;
  baselineSnapshotDate?: string;
}): RankingExperiment {
  const now = new Date().toISOString();
  return {
    id: createId(),
    businessId: params.businessId,
    userId: params.userId,
    auditId: params.audit.auditId,
    keyword: params.delta.keyword,
    gridNorth: params.delta.gridNorth,
    gridEast: params.delta.gridEast,
    leaderPlaceId: params.delta.leaderPlaceId,
    leaderName: params.delta.leaderName,
    actionType: params.action.actionType,
    planStepNumber: params.action.planStepNumber,
    hypothesis: params.action.hypothesis,
    leaderDelta: params.delta,
    marketKey: deriveMarketKey(params.audit),
    origin: params.origin,
    banditMetadata: params.banditMetadata,
    status: "proposed",
    executionTaskId: null,
    baselineSnapshotDate:
      params.baselineSnapshotDate ?? params.audit.completedAt.slice(0, 10),
    targetRankBefore: params.delta.clientRank,
    targetRankAfter: null,
    targetCellImproved: null,
    attributionWindowDays: RANK_ATTRIBUTION_WINDOW_DAYS,
    startedAt: null,
    concludedAt: null,
    conclusionReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

function resolveSelection(params: {
  delta: LeaderDelta;
  audit: FullAuditPayload;
  marketIndex?: MarketCalibrationIndex;
  banditSelection?: BanditSelection;
  actionIndex?: number;
  origin?: ExperimentOrigin;
}): BanditSelection | null {
  if (params.banditSelection) return params.banditSelection;

  const marketKey = deriveMarketKey(params.audit);
  return selectActionWithBandit({
    actions: params.delta.rankedActions,
    marketKey,
    marketIndex: params.marketIndex ?? new Map(),
    mode: params.origin === "manual" ? "manual" : "suggest",
    actionIndex: params.actionIndex,
  });
}

export async function proposeExperimentFromDelta(params: {
  audit: FullAuditPayload;
  delta: LeaderDelta;
  userId: string;
  businessId: string;
  client: import("@/audit/types").ClientConfig;
  baselineSnapshotDate?: string;
  origin?: ExperimentOrigin;
  banditSelection?: BanditSelection;
  actionIndex?: number;
  marketIndex?: MarketCalibrationIndex;
}): Promise<{ experiment: RankingExperiment; task: ExecutionTask }> {
  const existing = await getActiveExperimentForCellAdmin(
    params.businessId,
    params.delta.keyword,
    params.delta.gridNorth,
    params.delta.gridEast
  );
  if (existing) {
    throw new Error(
      `An experiment is already active for this cell (${existing.status}).`
    );
  }

  const selection = resolveSelection(params);
  if (!selection) {
    throw new Error("No actionable hypothesis for this cell.");
  }

  const experiment = buildExperimentRecord({
    audit: params.audit,
    delta: params.delta,
    userId: params.userId,
    businessId: params.businessId,
    action: selection.action,
    origin: params.origin ?? "manual",
    banditMetadata: banditMetadataFromSelection(selection),
    baselineSnapshotDate: params.baselineSnapshotDate,
  });

  const task = buildExecutionTaskForExperiment({
    audit: params.audit,
    experiment,
    action: selection.action,
  });

  const saved = await insertRankingExperiment(experiment);
  await appendExecutionTasks(params.userId, params.client, [task]);

  const linked = await updateRankingExperimentAdmin(saved.id, {
    status: "pending_approval",
    executionTaskId: task.id,
  });

  return {
    experiment: linked ?? { ...saved, status: "pending_approval", executionTaskId: task.id },
    task,
  };
}

export async function proposeSuggestedExperiment(params: {
  audit: FullAuditPayload;
  delta: LeaderDelta;
  userId: string;
  businessId: string;
  origin: ExperimentOrigin;
  banditSelection: BanditSelection;
  baselineSnapshotDate?: string;
}): Promise<RankingExperiment> {
  const existing = await getActiveExperimentForCellAdmin(
    params.businessId,
    params.delta.keyword,
    params.delta.gridNorth,
    params.delta.gridEast
  );
  if (existing) {
    throw new Error(
      `An experiment is already active for this cell (${existing.status}).`
    );
  }

  const experiment = buildExperimentRecord({
    audit: params.audit,
    delta: params.delta,
    userId: params.userId,
    businessId: params.businessId,
    action: params.banditSelection.action,
    origin: params.origin,
    banditMetadata: banditMetadataFromSelection(params.banditSelection),
    baselineSnapshotDate: params.baselineSnapshotDate,
  });

  return insertRankingExperiment(experiment);
}

export async function activateSuggestedExperiment(params: {
  experimentId: string;
  audit: FullAuditPayload;
  client: import("@/audit/types").ClientConfig;
  userId: string;
}): Promise<{ experiment: RankingExperiment; task: ExecutionTask }> {
  const experiment = await getRankingExperimentByIdAdmin(params.experimentId);
  if (!experiment) {
    throw new Error("Experiment not found.");
  }
  if (experiment.status !== "proposed" || experiment.origin !== "suggested") {
    throw new Error("Only suggested experiments can be activated.");
  }

  const action =
    experiment.leaderDelta.rankedActions[experiment.banditMetadata?.selectedIndex ?? 0] ??
    experiment.leaderDelta.rankedActions.find(
      (row) => row.actionType === experiment.actionType
    );
  if (!action) {
    throw new Error("Experiment action is no longer available.");
  }

  const task = buildExecutionTaskForExperiment({
    audit: params.audit,
    experiment,
    action,
  });

  await appendExecutionTasks(params.userId, params.client, [task]);

  const linked = await updateRankingExperimentAdmin(experiment.id, {
    status: "pending_approval",
    executionTaskId: task.id,
  });

  return {
    experiment: linked ?? {
      ...experiment,
      status: "pending_approval",
      executionTaskId: task.id,
    },
    task,
  };
}
