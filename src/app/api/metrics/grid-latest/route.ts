import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { loadLatestKeywordGridForUser } from "@/audit/storage-grid-snapshots";
import { getUser } from "@/lib/supabase/server";

/** Latest ingested geo-grid for map heatmap (weekly cron or audit) — no live Places call. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const keyword = searchParams.get("keyword");

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

  const snapshot = await loadLatestKeywordGridForUser(user.id, clientId, keyword);
  if (!snapshot) {
    return NextResponse.json({
      keyword,
      geoGrid: [],
      source: "none",
      date: null,
    });
  }

  return NextResponse.json({
    keyword,
    geoGrid: snapshot.geoGrid,
    source: snapshot.source,
    date: snapshot.date,
  });
}
