import { NextResponse } from "next/server";
import { getPrimaryBusiness, loadBusinessConfig } from "@/audit/businesses";
import type { ClientConfig } from "@/audit/types";
import { attachExecutionTasks } from "@/audit/attach-execution-tasks";
import { deriveMarketKey } from "@/audit/autopilot/market-key";
import { marketCalibrationToStepCalibration } from "@/audit/autopilot/market-calibration";
import { buildExperimentStepCalibration, winningExperimentStepsByKeyword } from "@/audit/autopilot/experiment-step-calibration";
import { buildPlan } from "@/audit/phase3/build-plan";
import { listActionAttributionsForUser } from "@/audit/storage-attribution";
import { loadGlobalScoreCalibration } from "@/audit/storage-calibration-global";
import { loadMarketCalibrationForMarketKey } from "@/audit/storage-calibration-market";
import { listConcludedExperimentsForBusinessAdmin } from "@/audit/storage-experiments";
import { listUnreadNotificationsForUser } from "@/audit/storage-notifications";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
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
  const marketKey = deriveMarketKey(audit);
  const businessId =
    client?.businessId ?? (await getBusinessIdForSlug(user.id, clientId));
  const [attributions, globalCalibration, marketIndex, concludedExperiments, notifications] =
    await Promise.all([
      listActionAttributionsForUser(user.id, clientId, 100),
      loadGlobalScoreCalibration(),
      loadMarketCalibrationForMarketKey(marketKey),
      businessId
        ? listConcludedExperimentsForBusinessAdmin(businessId)
        : Promise.resolve([]),
      businessId
        ? listUnreadNotificationsForUser(user.id, businessId)
        : Promise.resolve([]),
    ]);
  const marketRows = Array.from(marketIndex.values());
  const marketCalibration = marketCalibrationToStepCalibration(marketRows);
  const experimentStepCalibration = buildExperimentStepCalibration(concludedExperiments);
  const winningStepsByKeyword = Object.fromEntries(
    winningExperimentStepsByKeyword(concludedExperiments)
  );
  const plan = buildPlan(
    audit,
    tasks,
    attributions,
    globalCalibration,
    client?.avgCustomerValue,
    marketCalibration,
    experimentStepCalibration
  );

  return NextResponse.json({
    tasks,
    plan,
    planReconciledAt: audit.strategy.planReconciledAt ?? null,
    marketActionCalibration: marketRows,
    experimentStepCalibration,
    winningStepsByKeyword,
    unreadNotifications: notifications,
  });
}
