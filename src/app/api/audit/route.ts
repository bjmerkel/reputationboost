import { NextResponse } from "next/server";
import { listClients } from "@/audit/clients";
import { runPhase1Audit } from "@/audit/orchestrator";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { loadLatestAudit } from "@/audit/storage";
import { getUser } from "@/lib/supabase/server";
import type { AuditTrigger } from "@/audit/types";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = listClients();
  const latest = await Promise.all(
    clients.map(async (c) => ({
      client: c,
      latestAudit:
        (await loadLatestAuditFromSupabase(user.id, c.id)) ??
        (await loadLatestAudit(c.id)),
    }))
  );

  return NextResponse.json({ user: { id: user.id, email: user.email }, clients: latest });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      clientId?: string;
      trigger?: AuditTrigger;
    };

    const clientId = body.clientId ?? listClients()[0]?.id;
    if (!clientId) {
      return NextResponse.json({ error: "No client configured" }, { status: 400 });
    }

    const result = await runPhase1Audit({
      clientId,
      trigger: body.trigger ?? "manual",
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
