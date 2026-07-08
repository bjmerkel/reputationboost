import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadCampaignDashboard } from "@/lib/review-requests/campaign-dashboard";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const rawAudit = await loadLatestAuditFromSupabase(user.id, business.id, {
      businessName: business.name,
      businessUuid: business.businessId,
    });
    const audit = rawAudit ? ensureStrategy(rawAudit) : null;
    const dashboard = await loadCampaignDashboard(user.id, business.businessId, audit);

    return NextResponse.json(dashboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
