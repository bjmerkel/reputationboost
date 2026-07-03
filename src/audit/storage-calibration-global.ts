import type { ActionAttribution } from "@/audit/types/timeseries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildAttributionCalibration,
  type AttributionCalibration,
} from "@/audit/phase2/attribution-calibration";

export type GlobalCalibration = AttributionCalibration;

const STEP_FROM_ACTION_ITEM = /^gbp-step-(\d+)$/;

function rowToAttribution(row: Record<string, unknown>): ActionAttribution {
  const publishedAt = row.published_at as string;
  const windowDays = (row.window_days as number) ?? 14;
  const postEnd = new Date(publishedAt);
  postEnd.setUTCDate(postEnd.getUTCDate() + windowDays);

  return {
    id: row.id as string,
    executionTaskId: row.execution_task_id as string,
    businessId: row.business_id as string,
    taskType: row.task_type as string,
    actionItemId: row.action_item_id as string,
    title: "",
    publishedAt,
    windowDays,
    primaryKeyword: (row.primary_keyword as string) ?? null,
    rankBefore: (row.rank_before as number) ?? null,
    rankAfter: (row.rank_after as number) ?? null,
    rankDelta: (row.rank_delta as number) ?? null,
    keywordsImproved: (row.keywords_improved as number) ?? 0,
    callsDelta: (row.calls_delta as number) ?? null,
    directionsDelta: (row.directions_delta as number) ?? null,
    websiteClicksDelta: (row.website_clicks_delta as number) ?? null,
    impressionsDelta: (row.impressions_delta as number) ?? null,
    estimatedRevenue: row.estimated_revenue != null ? Number(row.estimated_revenue) : null,
    narrative: (row.narrative as string) ?? "",
    preliminary: new Date() < postEnd,
    computedAt: row.computed_at as string,
  };
}

export async function refreshGlobalScoreCalibration(): Promise<number> {
  const supabase = createAdminClient();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 180);

  const { data, error } = await supabase
    .from("action_attributions")
    .select("*")
    .gte("published_at", cutoff.toISOString())
    .order("published_at", { ascending: false })
    .limit(5000);

  if (error) throw new Error(`Failed to load attributions for calibration: ${error.message}`);

  const attributions = (data ?? [])
    .map((row) => rowToAttribution(row as Record<string, unknown>))
    .filter((a) => !a.preliminary && STEP_FROM_ACTION_ITEM.test(a.actionItemId));

  const calibration = buildAttributionCalibration(attributions);
  const rows = Object.entries(calibration).map(([step, cal]) => ({
    step_number: Number(step),
    sample_size: cal.sampleSize,
    median_rank_delta: cal.medianRankDelta,
    median_calls_delta: cal.medianCallsDelta,
    estimated_score_impact: cal.estimatedScoreImpact,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return 0;

  const { error: upsertError } = await supabase
    .from("score_calibration_global")
    .upsert(rows, { onConflict: "step_number" });

  if (upsertError) {
    throw new Error(`Failed to upsert score_calibration_global: ${upsertError.message}`);
  }

  return rows.length;
}

export async function loadGlobalScoreCalibration(): Promise<GlobalCalibration> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("score_calibration_global").select("*");

  if (error || !data || data.length === 0) return {};

  const calibration: GlobalCalibration = {};
  for (const row of data) {
    const step = row.step_number as number;
    calibration[step] = {
      sampleSize: row.sample_size as number,
      medianRankDelta:
        row.median_rank_delta != null ? Number(row.median_rank_delta) : null,
      medianCallsDelta:
        row.median_calls_delta != null ? Number(row.median_calls_delta) : 0,
      estimatedScoreImpact: row.estimated_score_impact as number,
    };
  }
  return calibration;
}

export async function loadGlobalScoreCalibrationAdmin(): Promise<GlobalCalibration> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("score_calibration_global").select("*");

  if (error || !data || data.length === 0) return {};

  const calibration: GlobalCalibration = {};
  for (const row of data) {
    const step = row.step_number as number;
    calibration[step] = {
      sampleSize: row.sample_size as number,
      medianRankDelta:
        row.median_rank_delta != null ? Number(row.median_rank_delta) : null,
      medianCallsDelta:
        row.median_calls_delta != null ? Number(row.median_calls_delta) : 0,
      estimatedScoreImpact: row.estimated_score_impact as number,
    };
  }
  return calibration;
}
