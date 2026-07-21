import type {
  AiVisibilitySnapshot,
  AiVisibilitySnapshotRow,
} from "@/audit/types/ai-visibility";
import { buildAiVisibilitySnapshot, scoreKeywordProbes } from "@/audit/collectors/ai-visibility/scoring";
import type { AiProbeResult } from "@/audit/types/ai-visibility";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";

function rowToDb(row: AiVisibilitySnapshotRow) {
  return {
    business_id: row.businessId,
    keyword: row.keyword,
    query_text: row.queryText,
    surface: row.surface,
    date: row.date,
    mentioned: row.mentioned,
    recommended: row.recommended,
    position: row.position,
    competitors_named: row.competitorsNamed,
    citations: row.citations,
    answer_excerpt: row.answerExcerpt,
    raw_response_hash: row.rawResponseHash,
    source: row.source,
  };
}

function dbRowToProbe(row: Record<string, unknown>): AiProbeResult {
  return {
    surface: row.surface as AiProbeResult["surface"],
    keyword: row.keyword as string,
    queryText: row.query_text as string,
    mentioned: Boolean(row.mentioned),
    recommended: Boolean(row.recommended),
    position: (row.position as number | null) ?? null,
    competitorsNamed: (row.competitors_named as AiProbeResult["competitorsNamed"]) ?? [],
    citations: (row.citations as AiProbeResult["citations"]) ?? [],
    answerExcerpt: (row.answer_excerpt as string) ?? "",
    rawResponseHash: (row.raw_response_hash as string) ?? "",
  };
}

export async function upsertAiVisibilitySnapshots(
  rows: AiVisibilitySnapshotRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_visibility_snapshots").upsert(
    rows.map(rowToDb),
    { onConflict: "business_id,keyword,surface,date,query_text" }
  );

  if (error) {
    throw new Error(`Failed to upsert ai_visibility_snapshots: ${error.message}`);
  }

  return rows.length;
}

export async function loadLatestAiVisibilityForBusiness(
  businessId: string,
  keywords: string[]
): Promise<AiVisibilitySnapshot | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_visibility_snapshots")
    .select("*")
    .eq("business_id", businessId)
    .order("date", { ascending: false })
    .limit(500);

  if (error || !data || data.length === 0) return null;

  const latestDate = data[0]?.date as string;
  const latestRows = data.filter((row) => row.date === latestDate);
  const probes = latestRows.map((row) => dbRowToProbe(row));
  const trackedKeywords = keywords.length > 0 ? keywords : [...new Set(probes.map((p) => p.keyword))];

  const snapshot = buildAiVisibilitySnapshot(probes, trackedKeywords, "cached");
  return {
    ...snapshot,
    collectedAt: `${latestDate}T00:00:00.000Z`,
  };
}

export async function loadLatestAiVisibilityForUser(
  userId: string,
  businessSlug: string,
  keywords: string[] = []
): Promise<AiVisibilitySnapshot | null> {
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return null;
  return loadLatestAiVisibilityForBusiness(businessId, keywords);
}

export async function listAiVisibilityTrendForUser(
  userId: string,
  businessSlug: string,
  keyword: string,
  days = 90
): Promise<Array<{ date: string; score: number; mentioned: boolean }>> {
  const supabase = await createClient();
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return [];

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  const { data, error } = await supabase
    .from("ai_visibility_snapshots")
    .select("*")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .gte("date", start.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error || !data) return [];

  const byDate = new Map<string, AiProbeResult[]>();
  for (const row of data) {
    const date = row.date as string;
    const probes = byDate.get(date) ?? [];
    probes.push(dbRowToProbe(row));
    byDate.set(date, probes);
  }

  return [...byDate.entries()].map(([date, probes]) => {
    const scored = scoreKeywordProbes(keyword, probes);
    return {
      date,
      score: scored.score,
      mentioned: scored.mentionRate > 0,
    };
  });
}
