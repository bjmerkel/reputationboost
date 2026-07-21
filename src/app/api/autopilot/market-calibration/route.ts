import { NextResponse } from "next/server";
import { deriveMarketKey } from "@/audit/autopilot/market-key";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { loadMarketCalibrationForMarketKey } from "@/audit/storage-calibration-market";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const audit = await loadLatestAuditFromSupabase(user.id, clientId);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const marketKey = deriveMarketKey(audit);
  const index = await loadMarketCalibrationForMarketKey(marketKey);
  const calibration = Array.from(index.values());

  return NextResponse.json({ marketKey, calibration });
}
