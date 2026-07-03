import { NextResponse } from "next/server";
import { loadBusinessConfig } from "@/audit/businesses";
import { auditBelongsToBusiness } from "@/audit/audit-validation";
import { loadAudit } from "@/audit/storage";
import { getUser } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string; auditId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, auditId } = await params;

  const audit = await loadAudit(clientId, auditId);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  if (audit.userId && audit.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const business = await loadBusinessConfig(user.id, clientId);
    if (!auditBelongsToBusiness(audit, business, user.id)) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  return NextResponse.json(audit);
}
