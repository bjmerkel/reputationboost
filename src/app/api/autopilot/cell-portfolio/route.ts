import { NextResponse } from "next/server";
import { attachExecutionTasks } from "@/audit/attach-execution-tasks";
import { buildCellPortfolio } from "@/audit/autopilot/cell-portfolio";
import { deriveMarketKey } from "@/audit/autopilot/market-key";
import { loadMarketCalibrationForMarketKey } from "@/audit/storage-calibration-market";
import { listRankingExperimentsForUser } from "@/audit/storage-experiments";
import {
  getBusinessIdForSlug,
  loadLatestAuditFromSupabase,
} from "@/audit/storage-supabase";
import { ensureStrategy } from "@/audit/ensure-strategy";
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

  const businessId = await getBusinessIdForSlug(user.id, clientId);
  if (!businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const rawAudit = await loadLatestAuditFromSupabase(user.id, clientId);
  if (!rawAudit?.strategy) {
    return NextResponse.json({ cells: [] });
  }

  const audit = ensureStrategy(attachExecutionTasks(rawAudit, rawAudit.execution?.tasks ?? []));
  const marketKey = deriveMarketKey(audit);
  const [experiments, marketIndex] = await Promise.all([
    listRankingExperimentsForUser(user.id, businessId, 50),
    loadMarketCalibrationForMarketKey(marketKey),
  ]);

  const cells = buildCellPortfolio({
    audit,
    experiments,
    marketIndex,
    limit: 12,
  });

  return NextResponse.json({ cells });
}
