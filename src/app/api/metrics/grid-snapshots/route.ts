import { NextResponse } from "next/server";
import { listGridSnapshotDatesForUser } from "@/audit/storage-grid-snapshots";
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
  const limit = Number(searchParams.get("limit") ?? "12");

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

  const snapshots = await listGridSnapshotDatesForUser(user.id, clientId, keyword, limit);
  return NextResponse.json({ keyword, snapshots, limit });
}
