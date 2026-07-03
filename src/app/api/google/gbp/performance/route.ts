import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { probePerformanceApiAccess } from "@/lib/google/gbp-performance";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.gbpConnection) {
    return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
  }

  const connection = await getValidGbpConnection(user.id, business);
  if (!connection) {
    return NextResponse.json({ error: "GBP connection expired" }, { status: 401 });
  }

  const probe = await probePerformanceApiAccess(connection, {
    platformEmail: user.email ?? undefined,
  });
  return NextResponse.json(probe);
}
