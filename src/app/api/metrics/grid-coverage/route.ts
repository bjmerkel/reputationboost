import { NextResponse } from "next/server";
import { listCoverageTrendForUser } from "@/audit/storage-grid-snapshots";
import { getPrimaryBusiness } from "@/audit/businesses";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const keyword = searchParams.get("keyword");
  const days = Number(searchParams.get("days") ?? "90");

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }

  const series = await listCoverageTrendForUser(user.id, clientId, keyword, days);
  return NextResponse.json({ keyword, series, days });
}
