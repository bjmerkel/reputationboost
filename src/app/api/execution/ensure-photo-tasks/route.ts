import { NextResponse } from "next/server";
import { loadBusinessConfig } from "@/audit/businesses";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { buildPhotoExecutionTasks } from "@/audit/phase3/gbp-plan-tasks";
import {
  appendExecutionTasks,
  listExecutionTasks,
} from "@/audit/storage-execution";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { buildTemplateContent } from "@/lib/llm/content";
import { getUser } from "@/lib/supabase/server";

/** Create photo tasks when missing (e.g. LLM plan used gbpAction: manual on step 6). */
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
    const existing = await listExecutionTasks(user.id, body.clientId, body.auditId);
    const activePhotoTasks = existing.filter(
      (t) => t.type === "gbp_photo" && t.status !== "completed" && t.status !== "rejected"
    );

    if (activePhotoTasks.length > 0) {
      return NextResponse.json({ tasks: activePhotoTasks, created: 0 });
    }

    const raw = await loadLatestAuditFromSupabase(user.id, body.clientId, {
      businessName: client.name,
      businessUuid: client.businessId,
    });

    if (!raw || raw.auditId !== body.auditId) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    const audit = ensureStrategy(raw);
    const content = buildTemplateContent(audit);
    const photoTasks = buildPhotoExecutionTasks(audit, content);

    if (photoTasks.length === 0) {
      return NextResponse.json({ tasks: [], created: 0 });
    }

    await appendExecutionTasks(user.id, client, photoTasks);

    return NextResponse.json({ tasks: photoTasks, created: photoTasks.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create photo tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
