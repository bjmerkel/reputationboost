import type { FullAuditPayload } from "@/audit/types";
import type { BusinessRecord } from "@/audit/businesses";
import { businessRecordToClientConfig } from "@/audit/businesses";
import { buildCompetitorProfileIndex, resolveCompetitorProfile } from "./competitor-profile-index";
import {
  buildClientProfileSnapshot,
  computeLeaderDelta,
  findTopLeaderDeltaForKeyword,
} from "./leader-delta-engine";
import { classifyLosingCells } from "./cell-loss-classifier";
import { deriveMarketKey } from "./market-key";
import { selectActionWithBandit, buildBusinessArmStatsFromExperiments } from "./bandit";
import type { AutopilotMode } from "./modes";
import { modeCreatesExecutionTask } from "./modes";
import {
  getActiveExperimentForCellAdmin,
  listConcludedExperimentsForBusinessAdmin,
  listProposedSuggestionsForBusinessAdmin,
} from "@/audit/storage-experiments";
import { loadMarketCalibrationForMarketKeyAdmin } from "@/audit/storage-calibration-market";
import {
  proposeExperimentFromDelta,
  proposeSuggestedExperiment,
} from "./plan-experiments";

function keywordImpressions(
  audit: FullAuditPayload,
  keyword: string
): number {
  return (
    audit.gbp.performance.searchKeywords?.find(
      (row) => row.keyword.toLowerCase() === keyword.toLowerCase()
    )?.impressions ?? 0
  );
}

export async function autoProposeExperimentForBusiness(params: {
  audit: FullAuditPayload;
  row: BusinessRecord;
  mode: AutopilotMode;
}): Promise<{ created: boolean; reason: string }> {
  if (!params.mode || params.mode === "off" || params.mode === "manual") {
    return { created: false, reason: "mode_disabled" };
  }

  const businessId = params.row.id;
  const existingSuggestions = await listProposedSuggestionsForBusinessAdmin(businessId);
  if (existingSuggestions.length > 0) {
    return { created: false, reason: "suggestion_pending" };
  }

  const activeStatuses = await import("@/audit/storage-experiments").then((m) =>
    m.listRankingExperimentsForBusinessAdmin(businessId, 5)
  );
  const hasActive = activeStatuses.some((exp) =>
    ["pending_approval", "running", "measuring"].includes(exp.status)
  );
  if (hasActive) {
    return { created: false, reason: "active_experiment" };
  }

  const keywords = params.audit.rankings.keywords
    .map((row) => row.keyword)
    .filter(Boolean);
  if (keywords.length === 0) {
    return { created: false, reason: "no_keywords" };
  }

  const competitorIndex = buildCompetitorProfileIndex(params.audit.competitors);
  const marketKey = deriveMarketKey(params.audit);
  const marketIndex = await loadMarketCalibrationForMarketKeyAdmin(marketKey);
  const businessStats = buildBusinessArmStatsFromExperiments(
    await listConcludedExperimentsForBusinessAdmin(businessId)
  );

  let best:
    | {
        keyword: string;
        delta: NonNullable<ReturnType<typeof computeLeaderDelta>>;
        priority: number;
      }
    | null = null;

  for (const keyword of keywords) {
    const snapshot = params.audit.rankings.keywords.find(
      (row) => row.keyword.toLowerCase() === keyword.toLowerCase()
    );
    if (!snapshot?.geoGrid?.length) continue;

    const impressions = keywordImpressions(params.audit, keyword);
    const impressionsWeight = impressions > 0 ? Math.log10(impressions + 10) : 1;
    const losing = classifyLosingCells(snapshot.geoGrid, impressionsWeight);
    if (losing.length === 0) continue;

    for (const cellSummary of losing.slice(0, 3)) {
      const cell = snapshot.geoGrid.find(
        (point) =>
          point.offsetNorthMiles === cellSummary.gridNorth &&
          point.offsetEastMiles === cellSummary.gridEast
      );
      if (!cell) continue;

      const existing = await getActiveExperimentForCellAdmin(
        businessId,
        keyword,
        cellSummary.gridNorth,
        cellSummary.gridEast
      );
      if (existing) continue;

      const leaderProfile = resolveCompetitorProfile(
        competitorIndex,
        keyword,
        cellSummary.leaderPlaceId
      );

      const delta = computeLeaderDelta({
        keyword,
        cell,
        client: buildClientProfileSnapshot(params.audit.gbp),
        leaderProfile,
        marketKey,
        marketIndex,
      });
      if (!delta || delta.rankedActions.length === 0) continue;

      if (!best || cellSummary.priority > best.priority) {
        best = { keyword, delta, priority: cellSummary.priority };
      }
    }
  }

  if (!best) {
    const fallback = findTopLeaderDeltaForKeyword(params.audit, keywords[0]!, {
      competitorIndex,
      marketIndex,
    });
    if (!fallback || fallback.rankedActions.length === 0) {
      return { created: false, reason: "no_losing_cells" };
    }
    best = {
      keyword: keywords[0]!,
      delta: fallback,
      priority: 0,
    };
  }

  const selection = selectActionWithBandit({
    actions: best.delta.rankedActions,
    marketKey,
    marketIndex,
    businessStats,
    mode: params.mode,
  });
  if (!selection) {
    return { created: false, reason: "no_action" };
  }

  const client = businessRecordToClientConfig(params.row);
  const origin = params.mode === "auto" ? "auto" : "suggested";

  if (modeCreatesExecutionTask(params.mode)) {
    await proposeExperimentFromDelta({
      audit: params.audit,
      delta: best.delta,
      userId: params.row.user_id,
      businessId,
      client,
      origin,
      banditSelection: selection,
    });
    return { created: true, reason: "queued_for_approval" };
  }

  await proposeSuggestedExperiment({
    audit: params.audit,
    delta: best.delta,
    userId: params.row.user_id,
    businessId,
    origin,
    banditSelection: selection,
  });
  return { created: true, reason: "suggested" };
}
