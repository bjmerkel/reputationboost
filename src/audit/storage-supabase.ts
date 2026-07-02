import type { ClientConfig, FullAuditPayload, Phase1AuditPayload } from "@/audit/types";
import { createClient } from "@/lib/supabase/server";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function ensureDemoBusiness(
  userId: string,
  config: ClientConfig
): Promise<string> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", config.id)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      user_id: userId,
      slug: config.id,
      name: config.name,
      industry: config.industry,
      location: config.location,
      keywords: config.keywords,
      gbp_place_id: config.gbpPlaceId ?? null,
      website: config.website ?? null,
      phone: config.phone ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create business: ${error.message}`);
  return data.id;
}

export async function saveAuditToSupabase(
  userId: string,
  businessId: string,
  audit: FullAuditPayload | Phase1AuditPayload
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("audit_runs").upsert(
    {
      business_id: businessId,
      user_id: userId,
      audit_id: audit.auditId,
      trigger: audit.trigger,
      period: audit.period,
      payload: audit,
      started_at: audit.startedAt,
      completed_at: audit.completedAt,
    },
    { onConflict: "business_id,audit_id" }
  );

  if (error) throw new Error(`Failed to save audit: ${error.message}`);
}

export async function loadLatestAuditFromSupabase(
  userId: string,
  businessSlug: string
): Promise<FullAuditPayload | null> {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", businessSlug)
    .maybeSingle();

  if (!business?.id) return null;

  const { data, error } = await supabase
    .from("audit_runs")
    .select("payload")
    .eq("user_id", userId)
    .eq("business_id", business.id)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) return null;
  return data.payload as FullAuditPayload;
}

export async function loadPriorAuditFromSupabase(
  userId: string,
  businessSlug: string,
  beforeCompletedAt: string
): Promise<FullAuditPayload | null> {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", businessSlug)
    .maybeSingle();

  if (!business?.id) return null;

  const { data, error } = await supabase
    .from("audit_runs")
    .select("payload")
    .eq("user_id", userId)
    .eq("business_id", business.id)
    .lt("completed_at", beforeCompletedAt)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) return null;
  return data.payload as FullAuditPayload;
}

export async function listAuditsFromSupabase(
  userId: string,
  businessSlug: string
): Promise<FullAuditPayload[]> {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", businessSlug)
    .maybeSingle();

  if (!business?.id) return [];

  const { data, error } = await supabase
    .from("audit_runs")
    .select("payload")
    .eq("user_id", userId)
    .eq("business_id", business.id)
    .order("completed_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => row.payload as FullAuditPayload);
}
