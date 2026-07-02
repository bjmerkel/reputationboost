import { NextResponse } from "next/server";
import { listAudits } from "@/audit/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;

  try {
    const audits = await listAudits(clientId);
    return NextResponse.json({ clientId, audits });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list audits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
