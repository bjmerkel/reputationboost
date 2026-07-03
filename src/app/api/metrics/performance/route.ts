import { NextResponse } from "next/server";
import { listPerformanceDailyForUser } from "@/audit/storage-timeseries";
import { getPrimaryBusiness } from "@/audit/businesses";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const days = Number(searchParams.get("days") ?? "30");

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const series = await listPerformanceDailyForUser(user.id, clientId, days);
  return NextResponse.json({ series, days });
}
