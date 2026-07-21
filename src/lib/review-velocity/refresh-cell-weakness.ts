import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import type { FullAuditPayload, GeoGridPoint } from "@/audit/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildKeywordWeaknessIndex, type CellWeaknessScore } from "@/lib/review-velocity/cell-weakness";
import { loadKeywordGridsForAuditKeywords, upsertCellWeaknessScoresAdmin } from "@/lib/review-velocity/storage";

function reviewGapsFromAudit(audit: FullAuditPayload | null): Map<string, number> {
  const gaps = new Map<string, number>();
  for (const row of audit?.strategy.gbpPlan?.keywordRankings ?? []) {
    gaps.set(row.keyword, row.reviewGap ?? 0);
  }
  return gaps;
}

async function listBusinessKeywordsWithGrids(businessId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("grid_snapshots")
    .select("keyword")
    .eq("business_id", businessId)
    .eq("ranking_model", "radial_text_v2")
    .gt("cells_total", 1);

  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => row.keyword as string))];
}

async function loadLatestAuditForBusiness(businessId: string): Promise<FullAuditPayload | null> {
  const supabase = createAdminClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("user_id, slug, name")
    .eq("id", businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!business?.user_id || !business.slug) return null;

  const rawAudit = await loadLatestAuditForBusinessAdmin(
    business.user_id as string,
    businessId,
    business.slug as string,
    (business.name as string) ?? "Business"
  );
  return rawAudit ? ensureStrategy(rawAudit) : null;
}

export function buildWeaknessScoresForKeywordGrids(
  keywordGrids: Map<string, GeoGridPoint[]>,
  reviewGaps: Map<string, number>
): CellWeaknessScore[] {
  return buildKeywordWeaknessIndex(keywordGrids, reviewGaps);
}

export async function refreshCellWeaknessScoresForBusinessAdmin(
  businessId: string
): Promise<number> {
  const keywords = await listBusinessKeywordsWithGrids(businessId);
  if (keywords.length === 0) return 0;

  const date = new Date().toISOString().slice(0, 10);
  const keywordGrids = await loadKeywordGridsForAuditKeywords(businessId, keywords, date);
  if (keywordGrids.size === 0) return 0;

  const audit = await loadLatestAuditForBusiness(businessId);
  const gaps = reviewGapsFromAudit(audit);
  for (const keyword of keywords) {
    if (!gaps.has(keyword)) gaps.set(keyword, 0);
  }

  const scores = buildWeaknessScoresForKeywordGrids(keywordGrids, gaps);
  await upsertCellWeaknessScoresAdmin(businessId, scores);
  return scores.length;
}

export async function refreshCellWeaknessScoresAfterAuditGrids(
  businessId: string,
  audit: FullAuditPayload,
  auditDate: string
): Promise<number> {
  const keywords = audit.rankings.keywords.map((row) => row.keyword);
  const keywordGrids = await loadKeywordGridsForAuditKeywords(businessId, keywords, auditDate);
  if (keywordGrids.size === 0) return 0;

  const gaps = reviewGapsFromAudit(audit);
  const scores = buildWeaknessScoresForKeywordGrids(keywordGrids, gaps);
  await upsertCellWeaknessScoresAdmin(businessId, scores);
  return scores.length;
}
