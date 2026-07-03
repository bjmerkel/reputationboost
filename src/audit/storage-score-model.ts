import type { LearnedScoreModel } from "@/audit/phase2/score-learning";
import {
  DEFAULT_BLEND_WEIGHTS,
  DEFAULT_CLICK_SHARE_CURVE,
  DEFAULT_LEARNED_SCORE_MODEL,
  buildLearnedScoreModel,
} from "@/audit/phase2/score-learning";
import {
  listAllRankSnapshotsAdmin,
  listAllScoreDailyAdmin,
} from "@/audit/storage-score-daily";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PerformanceDailyRow } from "@/audit/types/timeseries";

function rowToModel(row: Record<string, unknown>): LearnedScoreModel {
  return {
    clickShare: {
      pack1: Number(row.click_share_pack1),
      pack2: Number(row.click_share_pack2),
      pack3: Number(row.click_share_pack3),
      outsidePack: Number(row.click_share_outside),
      deepOutside: Number(row.click_share_deep),
    },
    clickShareSamples: row.click_share_samples as number,
    blendWeights: {
      visibility: Number(row.blend_visibility),
      conversion: Number(row.blend_conversion),
      revenueCapture: Number(row.blend_revenue_capture),
    },
    blendSamples: row.blend_samples as number,
    source: row.source as LearnedScoreModel["source"],
    updatedAt: row.updated_at as string,
  };
}

function modelToRow(model: LearnedScoreModel) {
  return {
    id: 1,
    click_share_pack1: model.clickShare.pack1,
    click_share_pack2: model.clickShare.pack2,
    click_share_pack3: model.clickShare.pack3,
    click_share_outside: model.clickShare.outsidePack,
    click_share_deep: model.clickShare.deepOutside,
    click_share_samples: model.clickShareSamples,
    blend_visibility: model.blendWeights.visibility,
    blend_conversion: model.blendWeights.conversion,
    blend_revenue_capture: model.blendWeights.revenueCapture,
    blend_samples: model.blendSamples,
    source: model.source,
    updated_at: model.updatedAt,
  };
}

export async function listAllPerformanceDailyAdmin(
  days = 120
): Promise<PerformanceDailyRow[]> {
  const supabase = createAdminClient();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  const { data, error } = await supabase
    .from("performance_daily")
    .select("business_id, date, metric, value, source")
    .gte("date", start.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    businessId: row.business_id as string,
    date: row.date as string,
    metric: row.metric as PerformanceDailyRow["metric"],
    value: Number(row.value),
    source: row.source as PerformanceDailyRow["source"],
  }));
}

export async function refreshGlobalScoreModel(days = 120): Promise<LearnedScoreModel> {
  const [ranks, scores, performance] = await Promise.all([
    listAllRankSnapshotsAdmin(days),
    listAllScoreDailyAdmin(days),
    listAllPerformanceDailyAdmin(days),
  ]);

  const model = buildLearnedScoreModel({ ranks, scores, performance });
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("score_model_global")
    .upsert(modelToRow(model), { onConflict: "id" });

  if (error) {
    throw new Error(`Failed to upsert score_model_global: ${error.message}`);
  }

  return model;
}

export async function loadGlobalScoreModelAdmin(): Promise<LearnedScoreModel> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("score_model_global")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_LEARNED_SCORE_MODEL;
  return rowToModel(data as Record<string, unknown>);
}

export async function loadGlobalScoreModel(): Promise<LearnedScoreModel> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("score_model_global")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_LEARNED_SCORE_MODEL;
  return rowToModel(data as Record<string, unknown>);
}

export { DEFAULT_LEARNED_SCORE_MODEL, DEFAULT_CLICK_SHARE_CURVE, DEFAULT_BLEND_WEIGHTS };
