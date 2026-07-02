import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { listExecutionTasks } from "@/audit/storage-execution";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");
  const auditId = searchParams.get("auditId") ?? undefined;

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const tasks = await listExecutionTasks(user.id, clientId, auditId);
  return NextResponse.json({ tasks });
}
