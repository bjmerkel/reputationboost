import { NextResponse } from "next/server";
import { listClients } from "@/audit/clients";
import { runPhase1Audit } from "@/audit/orchestrator";
import { loadLatestAudit } from "@/audit/storage";
import type { AuditTrigger } from "@/audit/types";

export async function GET() {
  const clients = listClients();
  const latest = await Promise.all(
    clients.map(async (c) => ({
      client: c,
      latestAudit: await loadLatestAudit(c.id),
    }))
  );

  return NextResponse.json({ clients: latest });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      clientId?: string;
      trigger?: AuditTrigger;
    };

    const clientId = body.clientId ?? listClients()[0]?.id;
    if (!clientId) {
      return NextResponse.json({ error: "No client configured" }, { status: 400 });
    }

    const result = await runPhase1Audit(clientId, body.trigger ?? "manual");

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
