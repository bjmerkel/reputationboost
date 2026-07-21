import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { listRevenueTransactionsForUser } from "@/audit/revenue-attribution/storage";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const transactions = await listRevenueTransactionsForUser(user.id, clientId, limit);
  return NextResponse.json({ transactions });
}
