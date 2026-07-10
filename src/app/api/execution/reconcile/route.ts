import { NextResponse } from "next/server";
import { loadBusinessConfig } from "@/audit/businesses";
import { reconcilePlanForUser } from "@/audit/phase3/reconcile-plan";
import { PLAN_RECONCILE_FLAGS } from "@/lib/feature-flags";
import { getUser } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Manually refresh the Plan tab from the latest audit (no Places calls). */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!PLAN_RECONCILE_FLAGS.enabled) {
    return NextResponse.json({ error: "Plan reconcile is disabled" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { clientId?: string; auditId?: string };
    if (!body.clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const client = await loadBusinessConfig(user.id, body.clientId);
    const result = await reconcilePlanForUser(user.id, client, {
      auditId: body.auditId,
    });

    if (!result) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      planReconciledAt: result.audit.strategy.planReconciledAt ?? null,
      createdTasks: result.createdTasks.length,
      completedTasks: result.completedTasks.length,
      appendedStepNumbers: result.appendedStepNumbers,
      refreshedStepCount: result.refreshedStepCount,
      audit: result.audit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reconcile plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
