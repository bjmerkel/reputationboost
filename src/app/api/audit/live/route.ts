import { NextResponse } from "next/server";
import { getBusinessRecord, getPrimaryBusiness, loadBusinessConfig } from "@/audit/businesses";
import { buildLiveAudit } from "@/audit/live-audit";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
import { getUser } from "@/lib/supabase/server";

/** Hydrated audit: nightly ranks/grids + refreshed gaps and scores. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const refreshGbp = searchParams.get("refreshGbp") === "true";

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const business = await loadBusinessConfig(user.id, clientId);
  if (!business?.businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const businessId = await getBusinessIdForSlug(user.id, clientId);
  if (!businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const businessRow = refreshGbp
    ? await getBusinessRecord(user.id, businessId)
    : null;

  try {
    const bundle = await buildLiveAudit(businessId, {
      refreshGbp: Boolean(businessRow),
      businessRow: businessRow ?? undefined,
      userId: user.id,
      clientSlug: clientId,
      avgCustomerValue: business.avgCustomerValue,
      currency: business.avgCustomerValueCurrency,
    });

    if (!bundle) {
      return NextResponse.json({ error: "No audit found" }, { status: 404 });
    }

    return NextResponse.json({
      audit: bundle.audit,
      pathToHealthy: bundle.pathToHealthy,
      refreshedAt: bundle.refreshedAt,
      targetDate: bundle.targetDate,
      gbpRefreshed: bundle.gbpRefreshed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
