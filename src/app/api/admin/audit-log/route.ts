import { NextResponse } from "next/server";
import { listAdminAuditLog, listDistinctAuditActions } from "@/lib/admin/audit-log";
import { requireAdminApi } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApi("viewer");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const action = searchParams.get("action") ?? undefined;
  const adminUserId = searchParams.get("adminUserId") ?? undefined;
  const distinct = searchParams.get("distinct") === "actions";

  if (distinct) {
    const actions = await listDistinctAuditActions();
    return NextResponse.json({ actions });
  }

  const result = await listAdminAuditLog({ page, action, adminUserId });

  return NextResponse.json(result);
}
