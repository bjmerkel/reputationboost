import type { FullAuditPayload } from "@/audit/types";
import { auditBelongsToBusiness } from "@/audit/audit-validation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loadLatestAuditForBusinessAdmin(
  userId: string,
  businessId: string,
  businessSlug: string,
  businessName: string
): Promise<FullAuditPayload | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("audit_runs")
    .select("payload")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) return null;

  const audit = data.payload as FullAuditPayload;
  const belongs = auditBelongsToBusiness(
    audit,
    { id: businessSlug, name: businessName, businessId },
    userId
  );

  return belongs ? audit : null;
}
