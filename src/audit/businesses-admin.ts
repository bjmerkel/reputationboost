import type { BusinessRecord } from "@/audit/businesses";
import { createAdminClient } from "@/lib/supabase/admin";

/** All businesses ready for daily ingest (cron / backfill). */
export async function listOnboardedBusinesses(): Promise<BusinessRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("onboarding_complete", true)
    .not("gbp_location_id", "is", null)
    .not("gbp_refresh_token", "is", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to list onboarded businesses: ${error.message}`);
  return (data ?? []) as BusinessRecord[];
}

export async function getBusinessRecordByIdAdmin(
  businessId: string
): Promise<BusinessRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !data) return null;
  return data as BusinessRecord;
}
