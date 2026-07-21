import { loadLatestKeywordGridsAdmin } from "@/audit/storage-grid-snapshots";
import type { GeoGridPoint } from "@/audit/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildKeywordWeaknessIndex, type CellWeaknessScore } from "./cell-weakness";
import { CELL_WEEKLY_SEND_CAP } from "./pacing";

export async function loadKeywordGridsForAuditKeywords(
  businessId: string,
  keywords: string[],
  onOrBeforeDate?: string
): Promise<Map<string, GeoGridPoint[]>> {
  const date = onOrBeforeDate ?? new Date().toISOString().slice(0, 10);
  return loadLatestKeywordGridsAdmin(businessId, keywords, date);
}

export async function countCellSendsThisWeekAdmin(
  businessId: string,
  gridNorth: number,
  gridEast: number
): Promise<number> {
  const supabase = createAdminClient();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { count, error } = await supabase
    .from("sms_messages")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("target_grid_north", gridNorth)
    .eq("target_grid_east", gridEast)
    .in("status", ["sent", "simulated", "scheduled"])
    .gte("created_at", weekAgo.toISOString());

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function isCellSendCapReachedAdmin(
  businessId: string,
  gridNorth: number,
  gridEast: number
): Promise<boolean> {
  const sends = await countCellSendsThisWeekAdmin(businessId, gridNorth, gridEast);
  return sends >= CELL_WEEKLY_SEND_CAP;
}

export async function upsertCellWeaknessScoresAdmin(
  businessId: string,
  scores: CellWeaknessScore[]
): Promise<void> {
  if (scores.length === 0) return;

  const supabase = createAdminClient();
  const computedAt = new Date().toISOString();
  const rows = scores.map((score) => ({
    business_id: businessId,
    keyword: score.keyword,
    grid_north: score.gridNorth,
    grid_east: score.gridEast,
    zone_direction: score.zoneDirection,
    rank: score.rank,
    in_local_pack: score.inLocalPack,
    review_gap: score.reviewGap,
    weakness_score: score.weaknessScore,
    computed_at: computedAt,
  }));

  const { error } = await supabase.from("cell_weakness_scores").insert(rows);
  if (error) throw new Error(error.message);
}

export function buildWeaknessScoresFromGrids(
  keywordGrids: Map<string, GeoGridPoint[]>,
  reviewGaps: Map<string, number>
): CellWeaknessScore[] {
  return buildKeywordWeaknessIndex(keywordGrids, reviewGaps);
}
