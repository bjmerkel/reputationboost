import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { buildPlan } from "@/audit/phase3/build-plan";
import { listActionAttributionsForUser } from "@/audit/storage-attribution";
import { listExecutionTasks } from "@/audit/storage-execution";
import {
  loadAuditByIdFromSupabase,
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
  let clientId = searchParams.get("clientId");
  const auditId = searchParams.get("auditId") ?? undefined;
  const includePlan = searchParams.get("includePlan") !== "false";

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
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

  const audit = ensureStrategy(rawAudit);
  const attributions = await listActionAttributionsForUser(user.id, clientId, 100);
  const plan = buildPlan(audit, tasks, attributions);

  return NextResponse.json({ tasks, plan });
}
