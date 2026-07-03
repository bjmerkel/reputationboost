import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { buildAttributionSummary } from "@/audit/storage-attribution";
import { getUser } from "@/lib/supabase/server";

function parsePeriodDays(period: string | null): number {
  if (!period) return 30;
  const match = period.match(/^(\d+)d$/);
  return match ? Number(match[1]) : 30;
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const periodDays = parsePeriodDays(searchParams.get("period"));

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const summary = await buildAttributionSummary(user.id, clientId, periodDays);
  return NextResponse.json({ summary });
}
