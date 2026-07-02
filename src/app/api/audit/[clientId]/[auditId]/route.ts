import { NextResponse } from "next/server";
import { loadAudit } from "@/audit/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string; auditId: string }> }
) {
  const { clientId, auditId } = await params;

  const audit = await loadAudit(clientId, auditId);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  return NextResponse.json(audit);
}
