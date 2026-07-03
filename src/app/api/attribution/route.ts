import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { listActionAttributionsForUser } from "@/audit/storage-attribution";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const limit = Number(searchParams.get("limit") ?? "50");

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const attributions = await listActionAttributionsForUser(user.id, clientId, limit);
  return NextResponse.json({ attributions });
}
