import { NextResponse } from "next/server";
import { getPrimaryBusiness, loadBusinessConfig } from "@/audit/businesses";
import type { ClientConfig } from "@/audit/types";
import { attachExecutionTasks } from "@/audit/attach-execution-tasks";
import { buildPlan } from "@/audit/phase3/build-plan";
import { listActionAttributionsForUser } from "@/audit/storage-attribution";
import { loadGlobalScoreCalibration } from "@/audit/storage-calibration-global";
import { listExecutionTasks } from "@/audit/storage-execution";
import {
  loadAuditByIdFromSupabase,
  loadLatestAuditFromSupabase,
} from "@/audit/storage-supabase";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { getUser } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const auditId = searchParams.get("auditId") ?? undefined;
  const includePlan = searchParams.get("includePlan") !== "false";

  let client: ClientConfig | null = null;
  if (!clientId) {
    client = await getPrimaryBusiness(user.id);
    clientId = client?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  if (!client) {
    try {
      client = await loadBusinessConfig(user.id, clientId);
    } catch {
      client = null;
    }
  }

  const tasks = await listExecutionTasks(user.id, clientId, auditId);

  if (!includePlan) {
    return NextResponse.json({ tasks });
  }

  const rawAudit = auditId
    ? await loadAuditByIdFromSupabase(user.id, clientId, auditId)
    : await loadLatestAuditFromSupabase(user.id, clientId);

  if (!rawAudit?.strategy) {
    return NextResponse.json({ tasks, plan: null });
  }

  const audit = ensureStrategy(attachExecutionTasks(rawAudit, tasks));
  const [attributions, globalCalibration] = await Promise.all([
    listActionAttributionsForUser(user.id, clientId, 100),
    loadGlobalScoreCalibration(),
  ]);
  const plan = buildPlan(
    audit,
    tasks,
    attributions,
    globalCalibration,
    client?.avgCustomerValue
  );

  return NextResponse.json({
    tasks,
    plan,
    planReconciledAt: audit.strategy.planReconciledAt ?? null,
  });
}
