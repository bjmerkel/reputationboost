import { NextResponse } from "next/server";
import { loadBusinessConfig } from "@/audit/businesses";
import { ensureStrategy } from "@/audit/ensure-strategy";
import {
  appendExecutionTasks,
  listExecutionTasks,
} from "@/audit/storage-execution";
import { loadLatestAuditFromSupabase, saveAuditToSupabase } from "@/audit/storage-supabase";
import { getValidGbpConnection } from "@/lib/google/token-store";
import {
  applyGoogleUpdatePatchToAudit,
  fetchLiveGoogleUpdateState,
} from "@/lib/google/gbp-update-sync";
import { missingGoogleSuggestionTasks } from "@/lib/google/gbp-update-helpers";
import { getUser } from "@/lib/supabase/server";

/** Refresh live Google update masks and ensure accept/reject tasks exist. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { clientId?: string; auditId?: string };
    if (!body.clientId || !body.auditId) {
      return NextResponse.json({ error: "clientId and auditId are required" }, { status: 400 });
    }

    const client = await loadBusinessConfig(user.id, body.clientId);
    if (!client.gbpConnection) {
      return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
    }

    const connection = await getValidGbpConnection(user.id, client);
    if (!connection) {
      return NextResponse.json({ error: "GBP connection expired" }, { status: 401 });
    }

    const raw = await loadLatestAuditFromSupabase(user.id, body.clientId, {
      businessName: client.name,
      businessUuid: client.businessId,
    });
    if (!raw || raw.auditId !== body.auditId) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    const live = await fetchLiveGoogleUpdateState(connection);
    const patched = applyGoogleUpdatePatchToAudit(ensureStrategy(raw), live);
    await saveAuditToSupabase(user.id, client.businessId!, patched);

    const existing = await listExecutionTasks(user.id, body.clientId, body.auditId);
    const created = missingGoogleSuggestionTasks(patched, existing);
    if (created.length > 0) {
      await appendExecutionTasks(user.id, client, created);
    }

    return NextResponse.json({
      audit: patched,
      googleUpdateState: live.googleUpdateState,
      createdTasks: created.length,
      resolved: live.resolved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh Google updates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
