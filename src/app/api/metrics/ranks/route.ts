import { NextResponse } from "next/server";
import { listRankTrendForUser } from "@/audit/storage-timeseries";
import { getPrimaryBusiness } from "@/audit/businesses";
import { getUser } from "@/lib/supabase/server";
import { RADIAL_RING_MILES } from "@/lib/google/radial-rankings";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const keyword = searchParams.get("keyword");
  const days = Number(searchParams.get("days") ?? "90");
  const radiusMiles = searchParams.get("radiusMiles");
  const multiRadius =
    searchParams.get("multiRadius") === "true" ||
    (searchParams.get("multiRadius") !== "false" && radiusMiles == null);

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

  const series = await listRankTrendForUser(user.id, clientId, keyword, days, {
    multiRadius,
    radiusMiles: radiusMiles != null ? Number(radiusMiles) : undefined,
  });

  return NextResponse.json({
    keyword,
    series,
    days,
    multiRadius,
    radii: multiRadius
      ? [...RADIAL_RING_MILES]
      : [radiusMiles != null ? Number(radiusMiles) : 0],
  });
}
