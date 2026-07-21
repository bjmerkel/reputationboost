import type { ExecutionType } from "@/audit/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildMarketCalibrationFromExperiments,
  buildMarketCalibrationIndex,
  type MarketActionCalibration,
  type MarketCalibrationIndex,
  type MarketExperimentOutcome,
} from "@/audit/autopilot/market-calibration";

function rowToMarketCalibration(row: Record<string, unknown>): MarketActionCalibration {
  return {
    marketKey: row.market_key as string,
    actionType: row.action_type as ExecutionType,
    planStepNumber:
      row.step_number != null ? Number(row.step_number) : null,
    sampleSize: Number(row.sample_size ?? 0),
    medianTargetCellRankDelta:
      row.median_target_cell_rank_delta != null
        ? Number(row.median_target_cell_rank_delta)
        : null,
    medianRankImprovement:
      row.median_rank_improvement != null
        ? Number(row.median_rank_improvement)
        : null,
    winRate: row.win_rate != null ? Number(row.win_rate) : 0,
    confidence: row.confidence as MarketActionCalibration["confidence"],
  };
}

export async function refreshMarketScoreCalibration(): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 365);

  const { data, error } = await supabase
    .from("ranking_experiments")
    .select(
      "market_key, action_type, plan_step_number, status, target_rank_before, target_rank_after, target_cell_improved, concluded_at"
    )
    .in("status", ["won", "lost", "inconclusive"])
    .gte("concluded_at", cutoff.toISOString())
    .limit(5000);

  if (error) {
    throw new Error(`Failed to load ranking experiments for market calibration: ${error.message}`);
  }

  const experiments: MarketExperimentOutcome[] = (data ?? []).map((row) => {
    const before =
      row.target_rank_before != null ? Number(row.target_rank_before) : null;
    const after =
      row.target_rank_after != null ? Number(row.target_rank_after) : null;
    return {
      marketKey: row.market_key as string,
      actionType: row.action_type as ExecutionType,
      planStepNumber:
        row.plan_step_number != null ? Number(row.plan_step_number) : null,
      status: row.status as MarketExperimentOutcome["status"],
      targetRankBefore: before,
      targetRankAfter: after,
      targetCellRankDelta:
        before != null && after != null ? after - before : null,
    };
  });

  const calibration = buildMarketCalibrationFromExperiments(experiments);
  if (calibration.length === 0) return 0;

  const rows = calibration.map((entry) => ({
    market_key: entry.marketKey,
    action_type: entry.actionType,
    step_number: entry.planStepNumber,
    sample_size: entry.sampleSize,
    median_target_cell_rank_delta: entry.medianTargetCellRankDelta,
    median_rank_improvement: entry.medianRankImprovement,
    win_rate: entry.winRate,
    confidence: entry.confidence,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("score_calibration_market")
    .upsert(rows, { onConflict: "market_key,action_type" });

  if (upsertError) {
    throw new Error(`Failed to upsert score_calibration_market: ${upsertError.message}`);
  }

  return rows.length;
}

export async function loadMarketCalibrationAdmin(): Promise<MarketActionCalibration[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("score_calibration_market").select("*");
  if (error || !data) return [];
  return data.map((row) => rowToMarketCalibration(row as Record<string, unknown>));
}

export async function loadMarketCalibrationIndexAdmin(): Promise<MarketCalibrationIndex> {
  return buildMarketCalibrationIndex(await loadMarketCalibrationAdmin());
}

export async function loadMarketCalibrationForMarketKey(
  marketKey: string
): Promise<MarketCalibrationIndex> {
  const supabase = await createClient();
  const prefixes = marketKey.split("|");
  const keys = [
    marketKey,
    prefixes.length >= 2 ? `${prefixes[0]}|${prefixes[1]}` : null,
    prefixes[0] ?? null,
  ].filter((value): value is string => Boolean(value));

  const { data, error } = await supabase
    .from("score_calibration_market")
    .select("*")
    .in("market_key", keys);

  if (error || !data) return new Map();
  return buildMarketCalibrationIndex(
    data.map((row) => rowToMarketCalibration(row as Record<string, unknown>))
  );
}

export async function loadMarketCalibrationForMarketKeyAdmin(
  marketKey: string
): Promise<MarketCalibrationIndex> {
  const all = await loadMarketCalibrationAdmin();
  const prefixes = marketKey.split("|");
  const keys = new Set(
    [
      marketKey,
      prefixes.length >= 2 ? `${prefixes[0]}|${prefixes[1]}` : null,
      prefixes[0] ?? null,
    ].filter((value): value is string => Boolean(value))
  );
  return buildMarketCalibrationIndex(all.filter((row) => keys.has(row.marketKey)));
}
